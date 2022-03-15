variable "cluster_name" {
    default = "genome"
}

variable "env_name" {
    default = "local"
}


/*

module "local_services" {
  source              = "./services"
  cluster_name        = "minikube"
  env_name            = "local"
  app_name            = "genome-a"
  app_namespace       = "genesis"
  kube_command        = "minikube kubectl --"
  elastic_crd_count   = 1
}

*/


module "dev_cluster" {
  source              = "./cluster"
  project_id          = "genome-285119"

  cluster_name        = "${var.cluster_name}"
  env_name            = "${var.env_name}"
  regional            = false

  # separate multiple zones e.g.: "us-west1-a,us-west1-b,us-west1-c"
  zones               = "us-west1-b"

  service_account     = "602257772503-compute@developer.gserviceaccount.com"

  preemptible         = true
}

module "dev_services" {
  source              = "./services"
  cluster_name        = module.dev_cluster.cluster_name
  cluster_config_file = module.dev_cluster.cluster_conf
  env_name            = "${var.env_name}"
  app_name            = "genome-a"
  app_namespace       = "genesis"
  elastic_crd_count   = 1
}
