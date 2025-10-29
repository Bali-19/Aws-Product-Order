import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as elasticbeanstalk from "aws-cdk-lib/aws-elasticbeanstalk";
import * as s3assets from "aws-cdk-lib/aws-s3-assets";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmgr from "aws-cdk-lib/aws-secretsmanager";

export class CdkBeanstalkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = "product-order-eb";
    const envName = "product-order-env";

    // ✅ VPC
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1
    });

    // ✅ Secret for DB credentials
    const dbSecret = new secretsmgr.Secret(this, "DbSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: "appuser",
        }),
        generateStringKey: "password",
      },
    });

    // ✅ RDS (MySQL)
    const db = new rds.DatabaseInstance(this, "AppRds", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_35,
      }),

      vpc,
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO
      ),
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      publiclyAccessible: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      databaseName: "productorderdb"
    });

    // ✅ EB Security Group → allow outbound to DB
    const ebSg = new ec2.SecurityGroup(this, "EbSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });

    // ✅ DB security — allow EB to connect
    db.connections.allowDefaultPortFrom(ebSg);

    // ✅ EB Application
    const app = new elasticbeanstalk.CfnApplication(this, "App", {
      applicationName: appName,
    });

    // ✅ Dockerrun bundle
    const appBundle = new s3assets.Asset(this, "Dockerrun", {
      path: "../eb-dockerrun"
    });

    // ✅ Version
    const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, "AppVer", {
      applicationName: app.applicationName!,
      sourceBundle: {
        s3Bucket: appBundle.s3BucketName,
        s3Key: appBundle.s3ObjectKey,
      },
    });

    appVersion.addDependency(app);

    // ✅ EB Environment
    new elasticbeanstalk.CfnEnvironment(this, "Environment", {
      environmentName: envName,
      applicationName: app.applicationName!,
      solutionStackName: "64bit Amazon Linux 2 v3.5.2 running Docker",
      versionLabel: appVersion.ref,

      optionSettings: [
        // ✅ Pass DB ENV automatically
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_HOST",
          value: db.dbInstanceEndpointAddress
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_NAME",
          value: "productorderdb"
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_USER",
          value: dbSecret.secretValueFromJson("username").toString()
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_PASS",
          value: dbSecret.secretValueFromJson("password").toString()
        },
      ]
    });
  }
}
