#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkBeanstalkStack } from '../lib/cdk-beanstalk-stack';

const app = new cdk.App();
new CdkBeanstalkStack(app, 'CdkBeanstalkStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});