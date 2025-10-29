import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elasticbeanstalk from "aws-cdk-lib/aws-elasticbeanstalk";
import * as s3_assets from "aws-cdk-lib/aws-s3-assets";
import * as path from "path";

export class CdkBeanstalkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* ------------------------------------------------------------------
     ✅ 1) VPC & Security Groups
    ------------------------------------------------------------------ */
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVPC", { isDefault: true });

    const ebSg = new ec2.SecurityGroup(this, "EbPublicSG", {
      vpc,
      allowAllOutbound: true,
      description: "EB instance SG",
    });
    ebSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    const dbSg = new ec2.SecurityGroup(this, "DbSG", {
      vpc,
      allowAllOutbound: true,
      description: "RDS SG",
    });
    dbSg.addIngressRule(ebSg, ec2.Port.tcp(3306), "Allow EB to MySQL");

    /* ------------------------------------------------------------------
     ✅ 2) RDS MySQL
    ------------------------------------------------------------------ */
    const rdsInstance = new rds.DatabaseInstance(this, "ProductRDS", {
      vpc,
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_43,
      }),
      instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO
      ),
      credentials: rds.Credentials.fromGeneratedSecret("admin"),
      databaseName: "product_order_EB_db",
      multiAz: false,
      publiclyAccessible: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deleteAutomatedBackups: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSg],
      allocatedStorage: 20,
    });

    const dbSecret = rdsInstance.secret!;

    /* ------------------------------------------------------------------
     ✅ 3) IAM Role + Instance Profile
    ------------------------------------------------------------------ */
    const instanceRole = new iam.Role(this, "EBInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    instanceRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSElasticBeanstalkWebTier")
    );
    instanceRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

    const instanceProfile = new iam.CfnInstanceProfile(this, "InstanceProfile", {
      roles: [instanceRole.roleName],
    });

    /* ------------------------------------------------------------------
     ✅ 4) EB Application + Version → Dockerrun.aws.json
    ------------------------------------------------------------------ */
    const app = new elasticbeanstalk.CfnApplication(this, "EBApp", {
      applicationName: "product-order-eb",
    });

    const dockerrunAsset = new s3_assets.Asset(this, "DockerrunAsset", {
      path: path.join(__dirname, "../eb-dockerrun"),
    });

    const appVersion = new elasticbeanstalk.CfnApplicationVersion(
        this,
        "EBAppVersion",
        {
          applicationName: app.applicationName!,
          sourceBundle: {
            s3Bucket: dockerrunAsset.s3BucketName,
            s3Key: dockerrunAsset.s3ObjectKey,
          },
        }
    );

    appVersion.addDependency(app);

    /* ------------------------------------------------------------------
     ✅ 5) EB Environment
    ------------------------------------------------------------------ */
    const ebEnv = new elasticbeanstalk.CfnEnvironment(this, "EBEnv", {
      environmentName: "product-order-env",
      applicationName: app.applicationName!,
      solutionStackName: "64bit Amazon Linux 2023 v4.7.3 running Docker",
      versionLabel: appVersion.ref,
      optionSettings: [
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "IamInstanceProfile",
          value: instanceProfile.ref,
        },
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "InstanceType",
          value: "t2.micro",
        },
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "SecurityGroups",
          value: ebSg.securityGroupId,
        },
        {
          namespace: "aws:ec2:vpc",
          optionName: "VPCId",
          value: vpc.vpcId,
        },
        {
          namespace: "aws:ec2:vpc",
          optionName: "Subnets",
          value: vpc.publicSubnets.map((s) => s.subnetId).join(","),
        },

        /* ✅ DB ENV CONFIG */
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "SPRING_DATASOURCE_USERNAME",
          value: dbSecret.secretValueFromJson("username").unsafeUnwrap(),
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "SPRING_DATASOURCE_PASSWORD",
          value: dbSecret.secretValueFromJson("password").unsafeUnwrap(),
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "SPRING_DATASOURCE_URL",
          value: `jdbc:mysql://${rdsInstance.dbInstanceEndpointAddress}:3306/product_order_EB_db?useSSL=false&serverTimezone=UTC`,
        },
      ],
    });

    /* ------------------------------------------------------------------
     ✅ 6) Outputs
    ------------------------------------------------------------------ */
    new cdk.CfnOutput(this, "DatabaseEndpoint", {
      value: rdsInstance.dbInstanceEndpointAddress,
    });

    new cdk.CfnOutput(this, "EB_URL", {
      value: ebEnv.attrEndpointUrl,
    });

    new cdk.CfnOutput(this, "DBSecretName", {
      value: dbSecret.secretName,
    });
  }
}
