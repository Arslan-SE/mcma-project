//"use strict";

// require
const util = require("util");
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

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

/**
 * get amejob id
 * @param {*} event 
 */
function getTransformJobId(event) {
    let id;

    if (event.data.transformJob) {
        event.data.transformJob.forEach(element => {
            if (element) {
                id = element;
                return true;
            }
        });
    }

    return id;
}

/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 */
function createBMEssence(bmContent, location) {
    // init bmcontent
    let bmEssence = new MCMA_CORE.BMEssence({
        "bmContent": bmContent.id,
        "locations": [location],
    });
    return bmEssence;
}

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
        event.progress = 63;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get transform job id
    let transformJobId = getTransformJobId(event);

    // in case we did note do a transcode
    if (!transformJobId) {
        return event.data.bmEssence;
    }

    // get result of transform job
    let transformJob = await resourceManager.resolve(transformJobId);

    // get media info
    let s3Bucket = transformJob.jobOutput.outputFile.awsS3Bucket;
    let s3Key = transformJob.jobOutput.outputFile.awsS3Key;

    // acquire the registered BMContent
    let bmc = await resourceManager.resolve(event.data.bmContent);

    // create BMEssence
    let locator = new MCMA_CORE.Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key
    });

    let bme = createBMEssence(bmc, locator);

    // register BMEssence
    bme = await resourceManager.create(bme);
    if (!bme.id) {
        throw new Error("Failed to register BMEssence.");
    }

    // addin BMEssence ID
    bmc.bmEssences.push(bme.id);

    // update BMContents
    bmc = await resourceManager.update(bmc);

    // the URL to the BMEssence with conformed media
    return bme.id;
}