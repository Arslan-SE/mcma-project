//"use strict";

global.fetch = require('node-fetch');

const fs = require("fs");

const AWS = require("aws-sdk");
AWS.config.loadFromPath('./aws-credentials.json');

const MCMA_CORE = require("mcma-core");

const convertTerraformOutputToJSON = (content) => {
    let object = {};

    let lines = content.split("\n");
    for (const line of lines) {
        var parts = line.split(" = ");

        if (parts.length === 2) {
            object[parts[0]] = parts[1];
        }
    }

    return object;
}

const main = async () => {
    if (process.argv.length !== 3) {
        console.error("Missing input file");
        process.exit(1);
    }

    try {
        let params = convertTerraformOutputToJSON(fs.readFileSync(process.argv[2], "utf8"));

        // 1. Initializing resource manager
        let servicesUrl = params.services_url;
        let servicesAuthType = params.services_auth_type;
        let servicesAuthContext = params.services_auth_context;

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

        let resourceManager = new MCMA_CORE.ResourceManager({
            servicesUrl,
            servicesAuthType,
            servicesAuthContext,
            authProvider
        });

        // 2. Inserting / Replacing workflow
        let name = "AiWorkflow";
        let workflowType = "AWSStepFunctionsWorkflow";
        let stateMachineArn = params.state_machine_arn;
       
        let workflow = {
            "@type": workflowType,
            name,
            inputParameters: [
                new MCMA_CORE.JobParameter({ parameterName: "bmContent", parameterType: "BMContent" }),
                new MCMA_CORE.JobParameter({ parameterName: "bmEssence", parameterType: "BMEssence" })
            ],
            stateMachineArn
        };

        let retrievedWorkflows = await resourceManager.get(workflowType);

        for (const retrievedWorkflow of retrievedWorkflows) {
            if (retrievedWorkflow.name === name) {
                if (!workflow.id) {
                    workflow.id = retrievedWorkflow.id;

                    console.log("Updating " + name);
                    await resourceManager.update(workflow);
                } else {
                    console.log("Removing duplicate " + name + " '" + retrievedWorkflow.id + "'");
                    await resourceManager.delete(retrievedWorkflow);
                }
            }
        }

        if (!workflow.id) {
            console.log("Inserting " + name);
            workflow = await resourceManager.create(workflow);
        }
    } catch (error) {
        if (error.response) {
            console.error(JSON.stringify(error.response.data.message, null, 2));
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}
main();
