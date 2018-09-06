#########################
# Module registration 
# Run a terraform get on each module before executing this script
#########################

module "cognito" {
  source = "./cognito"

  global_prefix = "${var.global_prefix}"

  upload_bucket     = "${var.upload_bucket}"
  temp_bucket       = "${var.temp_bucket}"
  repository_bucket = "${var.repository_bucket}"
  website_bucket    = "${var.website_bucket}"

  aws_account_id = "${var.aws_account_id}"
  aws_access_key = "${var.aws_access_key}"
  aws_secret_key = "${var.aws_secret_key}"
  aws_region     = "${var.aws_region}"
}

module "storage" {
  source = "./storage"

  global_prefix = "${var.global_prefix}"

  upload_bucket     = "${var.upload_bucket}"
  temp_bucket       = "${var.temp_bucket}"
  repository_bucket = "${var.repository_bucket}"
  website_bucket    = "${var.website_bucket}"

  aws_account_id = "${var.aws_account_id}"
  aws_access_key = "${var.aws_access_key}"
  aws_secret_key = "${var.aws_secret_key}"
  aws_region     = "${var.aws_region}"
}

module "services" {
  source = "./services"

  global_prefix = "${var.global_prefix}"

  upload_bucket     = "${var.upload_bucket}"
  temp_bucket       = "${var.temp_bucket}"
  repository_bucket = "${var.repository_bucket}"
  website_bucket    = "${var.website_bucket}"

  conform_workflow_id = "${module.workflows.conform_workflow_id}"
  ai_workflow_id      = "${module.workflows.ai_workflow_id}"

  aws_account_id = "${var.aws_account_id}"
  aws_access_key = "${var.aws_access_key}"
  aws_secret_key = "${var.aws_secret_key}"
  aws_region     = "${var.aws_region}"

  azure_location         = "${var.azure_location}"
  azure_account_id       = "${var.azure_account_id}"
  azure_subscription_key = "${var.azure_subscription_key}"
  azure_api_url          = "${var.azure_api_url}"

  environment_name = "${var.environment_name}"
  environment_type = "${var.environment_type}"
}

module "workflows" {
  source = "./workflows"

  global_prefix = "${var.global_prefix}"

  upload_bucket     = "${var.upload_bucket}"
  temp_bucket       = "${var.temp_bucket}"
  repository_bucket = "${var.repository_bucket}"
  website_bucket    = "${var.website_bucket}"

  aws_account_id = "${var.aws_account_id}"
  aws_access_key = "${var.aws_access_key}"
  aws_secret_key = "${var.aws_secret_key}"
  aws_region     = "${var.aws_region}"

  environment_type     = "${var.environment_type}"
  service_registry_url = "${module.services.service_registry_url}/services"
  repository_bucket    = "${module.storage.repository_bucket}"
  temp_bucket          = "${module.storage.temp_bucket}"
  website_bucket       = "${module.storage.website_bucket}"
}

output "aws_region" {
    value = "${var.aws_region}"
}

output "cognito_user_pool_id" {
    value = "${module.cognito.user_pool_id}"
}

output "cognito_user_pool_client_id" {
    value = "${module.cognito.user_pool_client_id}"
}

output "cognito_identity_pool_id" {
    value = "${module.cognito.identity_pool_id}"
}

output "upload_bucket" {
  value = "${module.storage.upload_bucket}"
}

output "website_bucket" {
  value = "${module.storage.website_bucket}"
}

output "website_url" {
  value = "${module.storage.website_url}"
}

output "service_registry_url" {
  value = "${module.services.service_registry_url}"
}

output "media_repository_url" {
  value = "${module.services.media_repository_url}"
}

output "job_repository_url" {
  value = "${module.services.job_repository_url}"
}

output "job_processor_service_url" {
  value = "${module.services.job_processor_service_url}"
}

output "ame_service_url" {
  value = "${module.services.ame_service_url}"
}

output "workflow_service_url" {
  value = "${module.services.workflow_service_url}"
}

output "transform_service_lambda_url" {
  value = "${module.services.transform_service_url}"
}

output "aws_ai_service_url" {
  value = "${module.services.aws_ai_service_url}"
}

output "azure_ai_service_url" {
  value = "${module.services.azure_ai_service_url}"
}
