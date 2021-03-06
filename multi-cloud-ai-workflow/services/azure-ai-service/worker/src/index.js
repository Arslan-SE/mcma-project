//"use strict";

const util = require('util');
const querystring = require('querystring');

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");
const uuidv4 = require('uuid/v4');
const URL = require("url").URL;

const JOB_PROFILE_TRANSCRIBE_AUDIO = "AzureTranscribeAudio";
const JOB_PROFILE_TRANSLATE_TEXT = "AzureTranslateText";
const JOB_PROFILE_EXTRACT_ALL_AI_METADATA = "AzureExtractAllAIMetadata";

let AzureApiUrl; //= "https://api.videoindexer.ai"  // need to move to a stage variale 
let AzureLocation;
let AzureAccountID;
let AzureSubscriptionKey;

const creds = {
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
    region: AWS.config.region
};

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator(creds);

const authProvider = new MCMA_CORE.AuthenticatorProvider(
    async (authType, authContext) => {
        switch (authType) {
            case "AWS4":
                return authenticatorAWS4;
        }
    }
);

const createResourceManager = (event) => {
    return new MCMA_CORE.ResourceManager({
        servicesUrl: event.stageVariables.ServicesUrl,
        servicesAuthType: event.stageVariables.ServicesAuthType,
        servicesAuthContext: event.stageVariables.ServicesAuthContext,
        authProvider
    });
}

exports.handler = async (event, context) => {
    try {
        console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        AzureApiUrl = event.stageVariables.AzureApiUrl; // "https://api.videoindexer.ai"   
        AzureLocation = event.stageVariables.AzureLocation;
        AzureAccountID = event.stageVariables.AzureAccountID;
        AzureSubscriptionKey = event.stageVariables.AzureSubscriptionKey;

        switch (event.action) {
            case "ProcessJobAssignment":
                await processJobAssignment(event);
                break;
            case "ProcessNotification":
                await processNotification(event);
                break;
        }
    } catch (error) {
        console.log("Error occurred when handling action '" + event.action + "'")
        console.log(error.toString());
    }
}

const processJobAssignment = async (event) => {
    let resourceManager = createResourceManager(event);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    try {
        // 1. Setting job assignment status to RUNNING
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "RUNNING");

        // 2. Retrieving Job
        let job = await retrieveJob(resourceManager, table, jobAssignmentId);

        // 3. Retrieve JobProfile
        let jobProfile = await retrieveJobProfile(resourceManager, job);

        // 4. Retrieve job inputParameters
        let jobInput = await retrieveJobInput(resourceManager, job);

        // 5. Check if we support jobProfile and if we have required parameters in jobInput
        validateJobProfile(jobProfile, jobInput);

        // 6. start the appropriate ai service
        let inputFile = jobInput.inputFile;
        let outputLocation = jobInput.outputLocation;

        let mediaFileUri;

        if (inputFile.httpEndpoint) {
            mediaFileUri = inputFile.httpEndpoint;
        } else {
            let data = await S3GetBucketLocation({ Bucket: inputFile.awsS3Bucket });
            console.log(JSON.stringify(data, null, 2));
            const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
            mediaFileUrl = "https://" + s3SubDomain + ".amazonaws.com/" + inputFile.awsS3Bucket + "/" + inputFile.awsS3Key;
        }

        let httpClient = new MCMA_CORE.HttpClient();

        let params, data;

        switch (jobProfile.name) {
            case JOB_PROFILE_TRANSCRIBE_AUDIO:
                throw new Error("Not Implemented");

            case JOB_PROFILE_EXTRACT_ALL_AI_METADATA:
                // implement call to azure

                // Get a token for API call - token are onlu good for one hour
                let authTokenUrl = AzureApiUrl + "/auth/" + AzureLocation + "/Accounts/" + AzureAccountID + "/AccessToken?allowEdit=true";
                let customHeaders = { 'Ocp-Apim-Subscription-Key': AzureSubscriptionKey };

                console.log("Generate Azure Video Indexer Token : Doing a GET on  : ", authTokenUrl);
                let response = await httpClient.get(authTokenUrl, {
                    headers: customHeaders
                });

                let apiToken = response.data;
                console.log("Azure API Token : ", apiToken);

                // call the Azure API to process the video 
                // in this scenario the video is located in a public link
                // so no need to upload the file to Azure

                /*                 Sample URL Structure      
                                   https://api.videoindexer.ai/{location}/Accounts/{accountId}/Videos?accessToken={accessToken}&
                                                                             name={name}?description={string}&
                                                                            partition={string}&
                                                                            externalId={string}&
                                                                            callbackUrl={string}&
                                                                            metadata={string}&
                                                                            language={string}&
                                                                            videoUrl={string}&
                                                                            fileName={string}&
                                                                            indexingPreset={string}&
                                                                            streamingPreset=Default&
                                                                            linguisticModelId={string}&
                                                                            privacy={string}&
                                                                            externalUrl={string}" */





                // Generate the call back URL leveraging the non secure api gateway endpoint

                const secureHost = new URL(jobAssignmentId).host;
                const nonSecureHost = new URL(event.stageVariables.PublicUrlNonSecure).host;

                var callbackUrl = jobAssignmentId.replace(secureHost, nonSecureHost);
                callbackUrl = callbackUrl + "/notifications";
                callbackUrl = querystring.escape(callbackUrl);

                console.log('Callback url for Video Indexer: ' + callbackUrl);

                let postVideoUrl = AzureApiUrl + "/" + AzureLocation + "/Accounts/" + AzureAccountID + "/Videos?accessToken=" + apiToken + "&name=" + inputFile.awsS3Key + "&callbackUrl=" + callbackUrl + "&videoUrl=" + mediaFileUri + "&fileName=" + inputFile.awsS3Key;

                console.log("Call Azure Video Indexer Video API : Doing a POST on  : ", postVideoUrl);

                let postVideoResponse = await httpClient.post(postVideoUrl);

                console.log("Azure API RAW Response postVideoResponse", postVideoResponse);

                if (postVideoResponse.status != 200) {
                    console.error("Azure Video Indexer - Error processing the video : ", response);
                }
                else {
                    let azureAssetInfo = postVideoResponse.data;
                    console.log("azureAssetInfo: ", JSON.stringify(azureAssetInfo, null, 2));

                    try {
                        console.log("updateJobAssignmentWithInfo");
                        console.log("table = ", table);
                        console.log("jobAssignmentId = ", jobAssignmentId);


                        await updateJobAssignmentWithInfo(table, jobAssignmentId, azureAssetInfo);
                    } catch (error) {
                        console.error("Error updating the job", error);
                    }
                }
                break;

            case JOB_PROFILE_TRANSLATE_TEXT:
                throw new Error("Not Implemented");
        }

        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(error);
        try {
            await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "FAILED", error.message);
        } catch (error) {
            console.error(error);
        }
    }
}

const processNotification = async (event) => {
    console.log("ProcessNotification", JSON.stringify(event, null, 2));
    let jobAssignmentId = event.jobAssignmentId;
    let notification = event.notification;

    let resourceManager = createResourceManager(event)
    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);

    let flagCounter = 0;
    let azureVideoId;
    let azureState;
    if (notification) {

        if (notification.id) {
            flagCounter++;
            azureVideoId = notification.id;
        }

        if (notification.state) {
            flagCounter++;
            azureState = notification.state
        }
    }

    console.log("azureVideoId = ", azureVideoId);
    console.log("azureState = ", azureState);

    if (flagCounter != 2) {
        console.error("looks like the POST is not coming from Azure Video Indexer: expecting two parameters id and state");
        return;
    }

    try {
        // Get the AI metadata form Azure for the video
        console.log("The POST is coming from Azure. Next steps, get the metadata for the video  ");

        let authTokenUrl = AzureApiUrl + "/auth/" + AzureLocation + "/Accounts/" + AzureAccountID + "/AccessToken?allowEdit=true";
        let customHeaders = { 'Ocp-Apim-Subscription-Key': AzureSubscriptionKey };
        let apiToken;

        console.log("Generate Azure Video Indexer Token : Doing a GET on  : ", authTokenUrl);
        let httpClient = new MCMA_CORE.HttpClient();

        let response = await httpClient.get(authTokenUrl, {
            headers: customHeaders
        });


        console.log("Azure API Token response : ", response);

        apiToken = response.data;
        console.log("Azure API Token : ", apiToken);


        // https://api.videoindexer.ai/{location}/Accounts/{accountId}/Videos/{videoId}/Index[?accessToken][&language]   

        let metadataFromAzureVideoIndexwer = AzureApiUrl + "/" + AzureLocation + "/Accounts/" + AzureAccountID + "/Videos/" + azureVideoId + "/Index?accessToken=" + apiToken + "&language=English";

        console.log("Get the azure video metadata : Doing a GET on  : ", metadataFromAzureVideoIndexwer);
        let indexedVideoMetadataResponse = await httpClient.get(metadataFromAzureVideoIndexwer);

        let videoMetadata = indexedVideoMetadataResponse.data;
        console.log("Azure AI video metadata : ", JSON.stringify(videoMetadata, null, 2));

        //Need to hydrate the destination bucket from the job input
        let workflowJob = await retrieveJob(resourceManager, table, jobAssignmentId);

        //Retrieve job inputParameters
        let jobInput = await retrieveJobInput(resourceManager, workflowJob);

        let jobOutputBucket = jobInput.outputLocation.awsS3Bucket;
        let jobOutputKeyPrefix = ((jobInput.outputLocation.awsS3KeyPrefix) ? jobInput.outputLocation.awsS3KeyPrefix : "");

        // get the info about the destination bucket to store the result of the job
        let s3Params = {
            Bucket: jobOutputBucket,
            Key: jobOutputKeyPrefix + azureVideoId + "-" + uuidv4() + ".json",
            Body: JSON.stringify(videoMetadata, null, 2)
        }

        await S3PutObject(s3Params);

        //updating JobAssignment with jobOutput
        let jobOutput = new MCMA_CORE.JobParameterBag({
            outputFile: new MCMA_CORE.Locator({
                awsS3Bucket: s3Params.Bucket,
                awsS3Key: s3Params.Key
            })
        });

        await updateJobAssignmentWithOutput(table, jobAssignmentId, jobOutput);

        // Setting job assignment status to COMPLETED
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "COMPLETED");

    } catch (error) {
        console.error(error);
        try {
            await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "FAILED", error.message);
        } catch (error) {
            console.error(error);
        }
    }
}

const validateJobProfile = (jobProfile, jobInput) => {
    if (jobProfile.name !== JOB_PROFILE_TRANSCRIBE_AUDIO &&
        jobProfile.name !== JOB_PROFILE_TRANSLATE_TEXT &&
        jobProfile.name !== JOB_PROFILE_EXTRACT_ALL_AI_METADATA) {
        throw new Error("JobProfile '" + jobProfile.name + "' is not supported");
    }

    if (jobProfile.inputParameters) {
        if (!Array.isArray(jobProfile.inputParameters)) {
            throw new Error("JobProfile.inputParameters is not an array");
        }

        for (parameter of jobProfile.inputParameters) {
            if (jobInput[parameter.parameterName] === undefined) {
                throw new Error("jobInput misses required input parameter '" + parameter.parameterName + "'");
            }
        }
    }
}

const retrieveJobInput = async (resourceManager, job) => {
    return await retrieveResource(resourceManager, job.jobInput, "job.jobInput");
}

const retrieveJobProfile = async (resourceManager, job) => {
    return await retrieveResource(resourceManager, job.jobProfile, "job.jobProfile");
}

const retrieveJob = async (resourceManager, table, jobAssignmentId) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);

    return await retrieveResource(resourceManager, jobAssignment.job, "jobAssignment.job");
}

const retrieveResource = async (resourceManager, resource, resourceName) => {
    if (!resource) {
        throw new Error(resourceName + " does not exist");
    }

    resource = await resourceManager.resolve(resource);

    let type = typeof resource;

    if (type === "object") {
        if (Array.isArray(resource)) {
            throw new Error(resourceName + " has illegal type 'Array'");
        }

        return resource;
    } else {
        throw new Error(resourceName + " has illegal type '" + type + "'");
    }
}

const updateJobAssignmentWithOutput = async (table, jobAssignmentId, jobOutput) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.jobOutput = jobOutput;
    await putJobAssignment(null, table, jobAssignmentId, jobAssignment);
}

const updateJobAssignmentWithInfo = async (table, jobAssignmentId, jobInfo) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.jobInfo = jobInfo;
    await putJobAssignment(null, table, jobAssignmentId, jobAssignment);
}

const updateJobAssignmentStatus = async (resourceManager, table, jobAssignmentId, status, statusMessage) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.status = status;
    jobAssignment.statusMessage = statusMessage;
    await putJobAssignment(resourceManager, table, jobAssignmentId, jobAssignment);
}

const getJobAssignment = async (table, jobAssignmentId) => {
    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        throw new Error("JobAssignment with id '" + jobAssignmentId + "' not found");
    }
    return jobAssignment;
}

const putJobAssignment = async (resourceManager, table, jobAssignmentId, jobAssignment) => {
    jobAssignment.dateModified = new Date().toISOString();
    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    if (resourceManager) {
        await resourceManager.sendNotification(jobAssignment);
    }
}
