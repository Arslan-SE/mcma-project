//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const S3 = new AWS.S3()
const S3HeadObject = util.promisify(S3.headObject.bind(S3));

const MCMA_CORE = require("mcma-core");

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
    region: AWS.config.region
});

const authProvider = new MCMA_CORE.AuthenticatorProvider(
    async (authType, authContext) => {
        switch (authType) {
            case "AWS4":
                return authenticatorAWS4;
        }
    }
);

const resourceManager = new MCMA_CORE.ResourceManager({
    servicesUrl: process.env.SERVICES_URL,
    servicesAuthType: process.env.SERVICES_AUTH_TYPE,
    servicesAuthContext: process.env.SERVICES_AUTH_CONTEXT,
    authProvider
});


/* Expecting input like the following:

{
    "input": {
        "metadata": {
            "@type": "DescriptiveMetadata",
            "name": "Cat video",
            "description": "Great video of cats"
        },
        "inputFile": {
            "@type": "Locator",
            "awsS3Bucket": "bucket_name",
            "awsS3Key": "key_name"
        }
    },
    "notificationEndpoint": {
        "@type": "NotificationEndpoint",
        "httpEndpoint": "http://workflow-service/job-assignments/34543-34-534345-34/notifications"
    }
}

Note that the notification endpoint is optional. But is used to notify progress and completed/failed of workflow.

*/

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
    
    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 0;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    if (!event || !event.input) {
        throw new Error("Missing workflow input");
    }

    let input = event.input;

    if (!input.metadata) {
        throw new Error("Missing input.metadata");
    }

    if (!input.metadata.name) {
        throw new Error("Missing input.metadata.name");
    }

    if (!event.input.metadata.description) {
        throw new Error("Missing input.metadata.description");
    }

    if (!input.inputFile) {
        throw new Error("Missing input.inputFile");
    }

    let s3Bucket = input.inputFile.awsS3Bucket;
    let s3Key = input.inputFile.awsS3Key;

    let data;

    try {
        data = await S3HeadObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    // if (!data.ContentType.startsWith("video")) {
    //     throw new Error("Input file is not a video");
    // }

    return data;
}