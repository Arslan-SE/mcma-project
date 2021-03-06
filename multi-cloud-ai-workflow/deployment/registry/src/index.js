//"use strict";

const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
AWS.config.loadFromPath('./aws-credentials.json');
const S3 = new AWS.S3();
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const Cognito = new AWS.CognitoIdentityServiceProvider();
const CognitoAdminCreateUser = util.promisify(Cognito.adminCreateUser.bind(Cognito));
const CognitoAdminDeleteUser = util.promisify(Cognito.adminDeleteUser.bind(Cognito));

global.fetch = require('node-fetch');
const AmazonCognitoIdentity = require("amazon-cognito-identity-js");

const MCMA_CORE = require("mcma-core");


const JOB_PROFILES = {
    ConformWorkflow: new MCMA_CORE.JobProfile({
        name: "ConformWorkflow",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "metadata", parameterType: "DescriptiveMetadata" }),
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "websiteMediaFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "aiWorkflow", parameterType: "WorkflowJob" }),
            new MCMA_CORE.JobParameter({ parameterName: "bmContent", parameterType: "BMContent" })
        ]
    }),
    AiWorkflow: new MCMA_CORE.JobProfile({
        name: "AiWorkflow",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "bmContent", parameterType: "BMContent" }),
            new MCMA_CORE.JobParameter({ parameterName: "bmEssence", parameterType: "BMEssence" })
        ]
    }),
    ExtractTechnicalMetadata: new MCMA_CORE.JobProfile({
        name: "ExtractTechnicalMetadata",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    CreateProxyLambda: new MCMA_CORE.JobProfile({
        name: "CreateProxyLambda",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    CreateProxyEC2: new MCMA_CORE.JobProfile({
        name: "CreateProxyEC2",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    ExtractThumbnail: new MCMA_CORE.JobProfile({
        name: "ExtractThumbnail",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ],
        optionalInputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "ebucore:width" }),
            new MCMA_CORE.JobParameter({ parameterName: "ebucore:height" })
        ]
    }),
    AWSTranscribeAudio: new MCMA_CORE.JobProfile({
        name: "AWSTranscribeAudio",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    AWSTranslateText: new MCMA_CORE.JobProfile({
        name: "AWSTranslateText",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "targetLanguageCode", parameterType: "awsLanguageCode" }),
            new MCMA_CORE.JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ],
        optionalInputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "sourceLanguageCode", parameterType: "awsLanguageCode" })
        ]
    }),
    AWSDetectCelebrities: new MCMA_CORE.JobProfile({
        name: "AWSDetectCelebrities",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    AzureExtractAllAIMetadata: new MCMA_CORE.JobProfile({
        name: "AzureExtractAllAIMetadata",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
}

const createServices = (serviceUrls) => {
    const serviceList = [];

    for (const prop in serviceUrls) {
        switch (prop) {
            case "ame_service_url":
                serviceList.push(
                    new MCMA_CORE.Service({
                        name: "MediaInfo AME Service",
                        resources: [
                            new MCMA_CORE.ResourceEndpoint({ resourceType: "JobAssignment", httpEndpoint: serviceUrls[prop] + "/job-assignments" })
                        ],
                        authType: "AWS4",
                        jobType: "AmeJob",
                        jobProfiles: [
                            JOB_PROFILES.ExtractTechnicalMetadata.id ? JOB_PROFILES.ExtractTechnicalMetadata.id : JOB_PROFILES.ExtractTechnicalMetadata
                        ]
                    })
                );
                break;
            case "aws_ai_service_url":
                serviceList.push(
                    new MCMA_CORE.Service({
                        name: "AWS AI Service",
                        resources: [
                            new MCMA_CORE.ResourceEndpoint({ resourceType: "JobAssignment", httpEndpoint: serviceUrls[prop] + "/job-assignments" })
                        ],
                        authType: "AWS4",
                        jobType: "AIJob",
                        jobProfiles: [
                            JOB_PROFILES.AWSTranscribeAudio.id ? JOB_PROFILES.AWSTranscribeAudio.id : JOB_PROFILES.AWSTranscribeAudio,
                            JOB_PROFILES.AWSTranslateText.id ? JOB_PROFILES.AWSTranslateText.id : JOB_PROFILES.AWSTranslateText,
                            JOB_PROFILES.AWSDetectCelebrities.id ? JOB_PROFILES.AWSDetectCelebrities.id : JOB_PROFILES.AWSDetectCelebrities
                        ]
                    })
                );
                break;
            case "azure_ai_service_url":
                serviceList.push(
                    new MCMA_CORE.Service({
                        name: "AZURE AI Service",
                        resources: [
                            new MCMA_CORE.ResourceEndpoint({ resourceType: "JobAssignment", httpEndpoint: serviceUrls[prop] + "/job-assignments" })
                        ],
                        authType: "AWS4",
                        jobType: "AIJob",
                        jobProfiles: [
                            JOB_PROFILES.AzureExtractAllAIMetadata.id ? JOB_PROFILES.AzureExtractAllAIMetadata.id : JOB_PROFILES.AzureExtractAllAIMetadata
                        ]
                    })
                );
                break;
            case "job_processor_service_url":
                serviceList.push(new MCMA_CORE.Service({
                    name: "Job Processor Service",
                    resources: [
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "JobProcess", httpEndpoint: serviceUrls[prop] + "/job-processes" })
                    ],
                    authType: "AWS4"
                }));
                break;
            case "job_repository_url":
                serviceList.push(new MCMA_CORE.Service({
                    name: "Job Repository",
                    resources: [
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "AmeJob", httpEndpoint: serviceUrls[prop] + "/jobs" }),
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "AIJob", httpEndpoint: serviceUrls[prop] + "/jobs" }),
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "CaptureJob", httpEndpoint: serviceUrls[prop] + "/jobs" }),
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "QAJob", httpEndpoint: serviceUrls[prop] + "/jobs" }),
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "TransferJob", httpEndpoint: serviceUrls[prop] + "/jobs" }),
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "TransformJob", httpEndpoint: serviceUrls[prop] + "/jobs" }),
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "WorkflowJob", httpEndpoint: serviceUrls[prop] + "/jobs" })
                    ],
                    authType: "AWS4"
                }));
                break;
            case "media_repository_url":
                serviceList.push(new MCMA_CORE.Service({
                    name: "Media Repository",
                    resources: [
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "BMContent", httpEndpoint: serviceUrls[prop] + "/bm-contents" }),
                        new MCMA_CORE.ResourceEndpoint({ resourceType: "BMEssence", httpEndpoint: serviceUrls[prop] + "/bm-essences" })
                    ],
                    authType: "AWS4"
                }));
                break;
            case "transform_service_url":
                serviceList.push(
                    new MCMA_CORE.Service({
                        name: "FFmpeg TransformService",
                        resources: [
                            new MCMA_CORE.ResourceEndpoint({ resourceType: "JobAssignment", httpEndpoint: serviceUrls[prop] + "/job-assignments" })
                        ],
                        authType: "AWS4",
                        jobType: "TransformJob",
                        jobProfiles: [
                            JOB_PROFILES.CreateProxyLambda.id ? JOB_PROFILES.CreateProxyLambda.id : JOB_PROFILES.CreateProxyLambda,
                            JOB_PROFILES.CreateProxyEC2.id ? JOB_PROFILES.CreateProxyEC2.id : JOB_PROFILES.CreateProxyEC2,
                        ],
                    })
                );
                break;
            case "workflow_service_url":
                serviceList.push(
                    new MCMA_CORE.Service({
                        name: "Workflow Service",
                        resources: [
                            new MCMA_CORE.ResourceEndpoint({ resourceType: "JobAssignment", httpEndpoint: serviceUrls[prop] + "/job-assignments" }),
                            new MCMA_CORE.ResourceEndpoint({ resourceType: "Notification", httpEndpoint: serviceUrls["workflow_service_notification_url"] })
                        ],
                        authType: "AWS4",
                        jobType: "WorkflowJob",
                        jobProfiles: [
                            JOB_PROFILES.ConformWorkflow.id ? JOB_PROFILES.ConformWorkflow.id : JOB_PROFILES.ConformWorkflow,
                            JOB_PROFILES.AiWorkflow.id ? JOB_PROFILES.AiWorkflow.id : JOB_PROFILES.AiWorkflow
                        ]
                    })
                );
                break;
        }
    }

    var services = {};

    for (const service of serviceList) {
        services[service.name] = service;
    }

    return services;
}

const readStdin = async () => {
    let content = "";

    process.stdin.on('data', (data) => {
        content += data.toString();
    });

    return await new Promise((resolve, reject) => {
        process.stdin.on('end', () => resolve(content));
        process.stdin.on('error', reject);
    });
}

const parseContent = (content) => {
    let serviceUrls = {};

    let lines = content.split("\n");
    for (const line of lines) {
        var parts = line.split(" = ");

        if (parts.length === 2) {
            serviceUrls[parts[0]] = parts[1];
        }
    }

    return serviceUrls;
}

const main = async () => {
    let content = await readStdin();
    let terraformOutput = parseContent(content);

    let servicesUrl = terraformOutput.services_url;
    let servicesAuthType = terraformOutput.services_auth_type;
    let servicesAuthContext = terraformOutput.services_auth_context;

    let jobProfilesUrl = terraformOutput.service_registry_url + "/job-profiles";

    // 1. (Re)create cognito user for website
    let username = "mcma";
    let tempPassword = "b9BC9aX6B3yQK#nr";
    let password = "%bshgkUTv*RD$sR7";

    try {
        var params = {
            UserPoolId: terraformOutput.cognito_user_pool_id,
            Username: "mcma"
        }

        // console.log(JSON.stringify(params, null, 2));

        let data = await CognitoAdminDeleteUser(params);
        console.log("Deleting existing user");
        // console.log(JSON.stringify(data, null, 2));
    } catch (error) {
    }

    try {
        var params = {
            UserPoolId: terraformOutput.cognito_user_pool_id,
            Username: username,
            MessageAction: "SUPPRESS",
            TemporaryPassword: tempPassword
        }

        // console.log(JSON.stringify(params, null, 2));

        console.log("Creating user '" + username + "' with temporary password");
        let data = await CognitoAdminCreateUser(params);

        // console.log(JSON.stringify(data, null, 2));

        var authenticationData = {
            Username: username,
            Password: tempPassword,
        };
        var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
        var poolData = {
            UserPoolId: terraformOutput.cognito_user_pool_id,
            ClientId: terraformOutput.cognito_user_pool_client_id
        };
        var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        var userData = {
            Username: username,
            Pool: userPool
        };
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

        console.log("Authenticating user '" + username + "' with temporary password");
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function (result) {
            },

            onFailure: function (err) {
                console.log("Unexpected error:", err);
            },

            newPasswordRequired: (userAttributes, requiredAttributes) => {
                console.log("Changing temporary password to final password");
                cognitoUser.completeNewPasswordChallenge(password, requiredAttributes, {
                    onSuccess: (session) => {
                        console.log("User '" + username + "' is ready with password '" + password + "'");
                    },
                    onFailure: (err) => {
                        console.log("Unexpected error:", err);
                    }
                });
            }
        });
    } catch (error) {
        console.log("Failed to setup user due to error:", error);
    }

    // 2. Uploading configuration to website
    console.log("Uploading deployment configuration to website");
    let config = {
        resourceManager: {
            servicesUrl,
            servicesAuthType,
            servicesAuthContext,
        },
        aws: {
            region: terraformOutput.aws_region,
            s3: {
                uploadBucket: terraformOutput.upload_bucket
            },
            cognito: {
                userPool: {
                    UserPoolId: terraformOutput.cognito_user_pool_id,
                    ClientId: terraformOutput.cognito_user_pool_client_id
                },
                identityPool: {
                    id: terraformOutput.cognito_identity_pool_id
                }
            }
        }
    }

    let s3Params = {
        Bucket: terraformOutput.website_bucket,
        Key: "config.json",
        Body: JSON.stringify(config)
    }
    try {
        await S3PutObject(s3Params);
    } catch (error) {
        console.error(error);
        return;
    }

    // 3. Inserting / updating service registry
    let serviceRegistry = new MCMA_CORE.Service({
        name: "Service Registry",
        resources: [
            new MCMA_CORE.ResourceEndpoint({ resourceType: "Service", httpEndpoint: servicesUrl }),
            new MCMA_CORE.ResourceEndpoint({ resourceType: "JobProfile", httpEndpoint: jobProfilesUrl })
        ],
        authType: "AWS4"
    });

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

    try {
        let resourceManager = new MCMA_CORE.ResourceManager({
            servicesUrl,
            servicesAuthType,
            servicesAuthContext,
            authProvider
        });
        let retrievedServices = await resourceManager.get("Service");

        for (const retrievedService of retrievedServices) {
            if (retrievedService.name === "Service Registry") {
                if (!serviceRegistry.id) {
                    serviceRegistry.id = retrievedService.id;

                    console.log("Updating Service Registry");
                    await resourceManager.update(serviceRegistry);
                } else {
                    console.log("Removing duplicate Service Registry '" + retrievedService.id + "'");
                    await resourceManager.delete(retrievedService);
                }
            }
        }

        if (!serviceRegistry.id) {
            console.log("Inserting Service Registry");
            serviceRegistry = await resourceManager.create(serviceRegistry);
        }

        // 4. reinitializing resourceManager
        await resourceManager.init();

        // 5. Inserting / updating job profiles
        let retrievedJobProfiles = await resourceManager.get("JobProfile");

        for (const retrievedJobProfile of retrievedJobProfiles) {
            let jobProfile = JOB_PROFILES[retrievedJobProfile.name];

            if (jobProfile && !jobProfile.id) {
                jobProfile.id = retrievedJobProfile.id;

                console.log("Updating JobProfile '" + jobProfile.name + "'");
                await resourceManager.update(jobProfile);
            } else {
                console.log("Removing " + (jobProfile && jobProfile.id ? "duplicate " : "") + "JobProfile '" + retrievedJobProfile.name + "'");
                //await resourceManager.delete(jobProfile[i]);
                await resourceManager.delete(retrievedJobProfile);
            }
        }

        for (const jobProfileName in JOB_PROFILES) {
            let jobProfile = JOB_PROFILES[jobProfileName];
            if (!jobProfile.id) {
                console.log("Inserting JobProfile '" + jobProfile.name + "'");
                JOB_PROFILES[jobProfileName] = await resourceManager.create(jobProfile);
            }
        }

        // 6. Inserting / updating services
        const SERVICES = createServices(terraformOutput);

        retrievedServices = await resourceManager.get("Service");

        for (const retrievedService of retrievedServices) {
            if (retrievedService.name === serviceRegistry.name) {
                continue;
            }

            let service = SERVICES[retrievedService.name];

            if (service && !service.id) {
                service.id = retrievedService.id;

                console.log("Updating Service '" + service.name + "'");
                await resourceManager.update(service);
            } else {
                console.log("Removing " + (service && service.id ? "duplicate " : "") + "Service '" + retrievedService.name + "'");
                await resourceManager.delete(retrievedService);
            }
        }

        for (const serviceName in SERVICES) {
            let service = SERVICES[serviceName];
            if (!service.id) {
                console.log("Inserting Service '" + service.name + "'");
                SERVICES[serviceName] = await resourceManager.create(service);
            }
        };
    } catch (error) {
        if (error.response) {
            console.error(JSON.stringify(error.response.data.message, null, 2));
        } else {
            console.error(error);
        }

    }
}
main();