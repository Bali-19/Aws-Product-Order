import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as elasticbeanstalk from "aws-cdk-lib/aws-elasticbeanstalk";
import * as s3assets from "aws-cdk-lib/aws-s3-assets";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmgr from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";

export class CdkBeanstalkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = "product-order-eb";
    const envName = "product-order-env";

    /* ----------------------------- VPC & Subnets ----------------------------- */
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC },
        { name: "private-egress", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: "isolated-db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED }
      ],
    });

    const publicSubnets = vpc.publicSubnets.map(s => s.subnetId).join(",");
    const appSubnets = vpc.privateSubnets.map(s => s.subnetId).join(","); // EB instances
    const dbSubnets = vpc.isolatedSubnets; // RDS

    /* ------------------------------ Security Groups ------------------------------ */
    const ebSg = new ec2.SecurityGroup(this, "EbSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "EB instances SG",
    });

    const dbSg = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "RDS SG",
    });

    // allow EB -> DB on 3306
    dbSg.addIngressRule(ebSg, ec2.Port.tcp(3306), "Allow EB instances to MySQL");

    /* --------------------------------- Secrets --------------------------------- */
    const dbSecret = new secretsmgr.Secret(this, "DbSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "appuser" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
    });

    /* ---------------------------------- RDS ---------------------------------- */
    const db = new rds.DatabaseInstance(this, "AppRds", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_35,
      }),
      vpc,
      vpcSubnets: { subnets: dbSubnets }, // isolated
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      publiclyAccessible: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      databaseName: "productorderdb",
    });

    /* ----------------------- EB Instance Role + Profile ----------------------- */
    const instanceRole = new iam.Role(this, "EbInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "Role for EB EC2 instances",
    });

    // Web tier baseline + SSM + ECR read (to pull from private ECR)
    instanceRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSElasticBeanstalkWebTier")
    );
    instanceRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );
    instanceRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly")
    );

    const instanceProfile = new iam.CfnInstanceProfile(this, "EbInstanceProfile", {
      roles: [instanceRole.roleName],
    });

    /* ------------------------------ EB Application ----------------------------- */
    const app = new elasticbeanstalk.CfnApplication(this, "App", {
      applicationName: appName,
    });

    const dockerrunAsset = new s3assets.Asset(this, "DockerrunAsset", {
      path: "../eb-dockerrun", // contains Dockerrun.aws.json (v1)
    });

    const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, "AppVersion", {
      applicationName: app.applicationName!,
      sourceBundle: {
        s3Bucket: dockerrunAsset.s3BucketName,
        s3Key: dockerrunAsset.s3ObjectKey,
      },
    });
    appVersion.addDependency(app);

    /* ---------------------------- EB Environment (AL2) ---------------------------- */
    const env = new elasticbeanstalk.CfnEnvironment(this, "Environment", {
      environmentName: envName,
      applicationName: app.applicationName!,
      // Use a valid Docker platform from your "list-available-solution-stacks"
      solutionStackName: "64bit Amazon Linux 2 v4.3.3 running Docker",
      versionLabel: appVersion.ref,
      optionSettings: [
        // VPC & Subnets: ALB on public, instances on private-egress
        { namespace: "aws:ec2:vpc", optionName: "VPCId", value: vpc.vpcId },
        { namespace: "aws:ec2:vpc", optionName: "ELBSubnets", value: publicSubnets },
        { namespace: "aws:ec2:vpc", optionName: "Subnets", value: appSubnets },

        // Instance profile & SG
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "IamInstanceProfile", value: instanceProfile.ref },
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "SecurityGroups", value: ebSg.securityGroupId },
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "InstanceType", value: "t3.micro" },

        // App ENV (flatten secret values to strings!)
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DB_HOST", value: db.dbInstanceEndpointAddress },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DB_PORT", value: db.dbInstanceEndpointPort },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DB_NAME", value: "productorderdb" },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_USER",
          value: dbSecret.secretValueFromJson("username").unsafeUnwrap(),
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_PASS",
          value: dbSecret.secretValueFromJson("password").unsafeUnwrap(),
        },

        { namespace: "aws:elasticbeanstalk:healthreporting:system", optionName: "SystemType", value: "enhanced" },
      ],
    });

    new cdk.CfnOutput(this, "EbUrl", { value: env.attrEndpointUrl });
    new cdk.CfnOutput(this, "DbEndpoint", { value: db.dbInstanceEndpointAddress });
  }
}
