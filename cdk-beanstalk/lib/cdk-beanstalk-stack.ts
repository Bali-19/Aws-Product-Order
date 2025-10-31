import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as elasticbeanstalk from "aws-cdk-lib/aws-elasticbeanstalk";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmgr from "aws-cdk-lib/aws-secretsmanager";

export class CdkBeanstalkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = "product-order-eb";
    const envName = "product-order-env";

    /* VPC */
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC },
        { name: "db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    /* Security Groups */
    const ebSG = new ec2.SecurityGroup(this, "EbSG", { vpc });
    const dbSG = new ec2.SecurityGroup(this, "DbSG", { vpc });

    dbSG.addIngressRule(ebSG, ec2.Port.tcp(3306), "Allow EB To RDS");

    /* DB Secret */
    const dbSecret = new secretsmgr.Secret(this, "DbSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "appuser" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
    });

    /* RDS Instance */
    const db = new rds.DatabaseInstance(this, "AppRds", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.of("8.0.37", "8.0"),
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromSecret(dbSecret),
      securityGroups: [dbSG],
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

    /* EB Application */
    const app = new elasticbeanstalk.CfnApplication(this, "App", {
      applicationName: appName,
    });

    /* EB Environment */
    const env = new elasticbeanstalk.CfnEnvironment(this, "Environment", {
      environmentName: envName,
      applicationName: appName,
      solutionStackName: "64bit Amazon Linux 2023 v4.7.0 running Corretto 17",
      optionSettings: [
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "InstanceType",
          value: "t3.micro",
        },
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "SecurityGroups",
          value: ebSG.securityGroupId,
        },

        /* DB ENV */
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

    env.addDependency(app);

    new cdk.CfnOutput(this, "EB_URL", {
      value: env.attrEndpointUrl,
    });

    new cdk.CfnOutput(this, "DB_ENDPOINT", {
      value: db.dbInstanceEndpointAddress,
    });
  }
}
