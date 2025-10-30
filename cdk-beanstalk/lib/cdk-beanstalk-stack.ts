import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as elasticbeanstalk from "aws-cdk-lib/aws-elasticbeanstalk";
import * as s3assets from "aws-cdk-lib/aws-s3-assets";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmgr from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam"
export class CdkBeanstalkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = "product-order-eb";
    const envName = "product-order-env";

    // VPC: عام + معزول (بدون NAT عشان التكلفة والمشاكل)
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC },
        { name: "db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // SG
    const ebSG = new ec2.SecurityGroup(this, "EbSG", { vpc, allowAllOutbound: true });
    const dbSG = new ec2.SecurityGroup(this, "DbSG", { vpc, allowAllOutbound: true });
    dbSG.addIngressRule(ebSG, ec2.Port.tcp(3306), "Allow EB TO RDS 3306");

    // Secret (username=appuser, auto password)
    const dbSecret = new secretsmgr.Secret(this, "DbSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "appuser" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
    });

    // RDS MySQL
    const db = new rds.DatabaseInstance(this, "AppRds", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.of("8.0.40","8.0"),
      }),
      vpc,
      vpcSubnets: { subnets: vpc.isolatedSubnets },
      securityGroups: [dbSG],
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      publiclyAccessible: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      databaseName: "productorderdb",
    });

    // EB Application
    const app = new elasticbeanstalk.CfnApplication(this, "App", {
      applicationName: appName,
    });

    // ✅ ارفع الـ JAR مباشرة (بدون ZIP)
    // يجب أن يكون موجوداً في المسار ../Backend/application.jar قبل cdk deploy (CI سيبنيه)
    const jarAsset = new s3assets.Asset(this, "JarAsset", {
      path: "../Backend/application.jar",
    });

    // EB App Version (source = الـ JAR)
    const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, "AppVersion", {
      applicationName: appName,
      sourceBundle: {
        s3Bucket: jarAsset.s3BucketName,
        s3Key: jarAsset.s3ObjectKey,
      },
      description: `build-${Date.now()}`,
    });
    appVersion.addDependency(app);

    /* ---------------- IAM Role + Instance Profile ---------------- */
    const ebEc2Role = new iam.Role(this, "EbEc2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AWSElasticBeanstalkWebTier"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonSSMManagedInstanceCore"
        )
      ],
    });

    const ebInstanceProfile = new iam.CfnInstanceProfile(this, "EbInstanceProfile", {
      roles: [ebEc2Role.roleName],
    });

    const env = new elasticbeanstalk.CfnEnvironment(this, "Environment", {
      environmentName: envName,
      applicationName: appName,
      solutionStackName: "64bit Amazon Linux 2023 v4.7.0 running Corretto 17",
      versionLabel: appVersion.ref,
      optionSettings: [
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "IamInstanceProfile",
          value: ebInstanceProfile.ref
        },
        {
          namespace: "aws:ec2:vpc",
          optionName: "VPCId",
          value: vpc.vpcId
        },
        {
          namespace: "aws:ec2:vpc",
          optionName: "Subnets",
          value: vpc.privateSubnets.map(s => s.subnetId).join(",")
        },
        {
          namespace: "aws:ec2:vpc",
          optionName: "ELBSubnets",
          value: vpc.publicSubnets.map(s => s.subnetId).join(",")
        },
        {
          namespace: "aws:ec2:vpc",
          optionName: "SecurityGroups",
          value: ebSG.securityGroupId
        },
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "InstanceType",
          value: "t3.micro"
        },
      ],
    });

    env.addDependency(appVersion);

    new cdk.CfnOutput(this, "EbUrl", { value: env.attrEndpointUrl });
    new cdk.CfnOutput(this, "DbEndpoint", { value: db.dbInstanceEndpointAddress });
  }
}
