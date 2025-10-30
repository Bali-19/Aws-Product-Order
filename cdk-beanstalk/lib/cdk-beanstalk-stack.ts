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

    /* ---------------------- VPC ---------------------- */
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC },
        { name: "app", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: "db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED }
      ],
    });

    /* -------------------- SG -------------------- */
    const ebSG = new ec2.SecurityGroup(this, "EbSG", { vpc });
    const dbSG = new ec2.SecurityGroup(this, "DbSG", { vpc });
    dbSG.addIngressRule(ebSG, ec2.Port.tcp(3306));

    /* -------------------- SECRET -------------------- */
    const dbSecret = new secretsmgr.Secret(this, "DbSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "appuser" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
    });

    /* -------------------- RDS -------------------- */
    const db = new rds.DatabaseInstance(this, "AppRds", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.of("8.4.6","8.4"),
      }),
      vpc,
      vpcSubnets: { subnets: vpc.isolatedSubnets },
      securityGroups: [dbSG],
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO
      ),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      publiclyAccessible: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      databaseName: "productorderdb",
    });

    /* -------------------- EB APP -------------------- */
    const app = new elasticbeanstalk.CfnApplication(this, "App", {
      applicationName: appName,
    });

    /* -------------------- EB VERSION ZIP -------------------- */
    const appZip = new s3assets.Asset(this, "AppZip", {
      path: "../app-bundle.zip",   // ✅ zip created by CI
    });

    const versionStamp = `V${Date.now()}`;

    const appVersion = new elasticbeanstalk.CfnApplicationVersion(
        this,
        "AppVersion",
        {
          applicationName: appName,
          sourceBundle: {
            s3Bucket: appZip.s3BucketName,
            s3Key: appZip.s3ObjectKey,
          },
          description: versionStamp,
        }
    );

    appVersion.addDependency(app);

    /* -------------------- EB ENV -------------------- */
    const env = new elasticbeanstalk.CfnEnvironment(this, "Environment", {
      environmentName: envName,
      applicationName: appName,
      versionLabel: appVersion.ref,
      solutionStackName:
          "64bit Amazon Linux 2023 v4.7.0 running Corretto 17",
      optionSettings: [
        {
          namespace: "aws:ec2:vpc",
          optionName: "VPCId",
          value: vpc.vpcId,
        },
        {
          namespace: "aws:ec2:vpc",
          optionName: "Subnets",
          value: vpc.privateSubnets.map((s) => s.subnetId).join(","),
        },
        {
          namespace: "aws:ec2:vpc",
          optionName: "ELBSubnets",
          value: vpc.publicSubnets.map((s) => s.subnetId).join(","),
        },
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "SecurityGroups",
          value: ebSG.securityGroupId,
        },
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "InstanceType",
          value: "t3.micro",
        },

        /* ---------------- ENV VARS ---------------- */
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_HOST",
          value: db.dbInstanceEndpointAddress,
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_PORT",
          value: db.dbInstanceEndpointPort,
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_NAME",
          value: "productorderdb",
        },
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
      ],
    });

    env.addDependency(appVersion);

    new cdk.CfnOutput(this, "EbUrl", { value: env.attrEndpointUrl });
    new cdk.CfnOutput(this, "DbEndpoint", {
      value: db.dbInstanceEndpointAddress,
    });
  }
}
