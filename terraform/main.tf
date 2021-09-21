# ---------------------------------------------------------------------------------------------------------------------
# DEPLOY A GKE PRIVATE CLUSTER IN GOOGLE CLOUD PLATFORM
# This is an example of how to use the gke-cluster module to deploy a private Kubernetes cluster in GCP.
# Load Balancer in front of it.
# ---------------------------------------------------------------------------------------------------------------------

terraform {
  # The modules used in this example have been updated with 0.12 syntax, additionally we depend on a bug fixed in
  # version 0.12.7.
  required_version = ">= 0.12.7"
}

# ---------------------------------------------------------------------------------------------------------------------
# PREPARE PROVIDERS
# ---------------------------------------------------------------------------------------------------------------------

provider "google" {
  version = "~> 3.1.0"
  project = var.project
  region  = var.region

  scopes = [
    # Default scopes
    "https://www.googleapis.com/auth/compute",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/ndev.clouddns.readwrite",
    "https://www.googleapis.com/auth/devstorage.full_control",

    # Required for google_client_openid_userinfo
    "https://www.googleapis.com/auth/userinfo.email",
  ]
}

provider "google-beta" {
  version = "~> 3.1.0"
  project = var.project
  region  = var.region

  scopes = [
    # Default scopes
    "https://www.googleapis.com/auth/compute",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/ndev.clouddns.readwrite",
    "https://www.googleapis.com/auth/devstorage.full_control",

    # Required for google_client_openid_userinfo
    "https://www.googleapis.com/auth/userinfo.email",
  ]
}


# Retrieve an access token as the Terraform runner
data "google_client_config" "provider" {}

data "google_container_cluster" "my_cluster" {
  name     = "my-cluster"
  location = "us-central1"
}


provider "kubernetes" {
  host                   = "https://${data.google_container_cluster.my_cluster.endpoint}"
  token                  = data.google_client_config.provider.access_token
  cluster_ca_certificate = base64decode(
    data.google_container_cluster.my_cluster.master_auth[0].cluster_ca_certificate,
  )
  load_config_file       = false
}


provider "helm" {
  # Use provider with Helm 3.x support
  version = "~> 1.1.1"

  kubernetes {
    host                   = "https://${data.google_container_cluster.my_cluster.endpoint}"
    token                  = data.google_client_config.provider.access_token
    cluster_ca_certificate = base64decode(
      data.google_container_cluster.my_cluster.master_auth[0].cluster_ca_certificate,
    )
    load_config_file       = false
  }
}





resource "google_compute_subnetwork" "genome_subnetwork" {
  name          = "genome-subnetwork"
  ip_cidr_range = "10.2.0.0/16"
  region        = "us-central1"
  network       = google_compute_network.genome_network.id
  secondary_ip_range {
    range_name    = "services-range"
    ip_cidr_range = "192.168.1.0/24"
  }

  secondary_ip_range {
    range_name    = "pod-ranges"
    ip_cidr_range = "192.168.64.0/22"
  }
}

resource "google_compute_network" "genome_network" {
  name                    = "genome-network"
  auto_create_subnetworks = false
}

resource "google_container_cluster" "genome_cluster" {
  name               = "genome-vpc-native-cluster"
  location           = "us-central1"

  network    = google_compute_network.genome_network.id
  subnetwork = google_compute_subnetwork.genome_subnetwork.id

  ip_allocation_policy {
    cluster_secondary_range_name  = "services-range"
    services_secondary_range_name = google_compute_subnetwork.genome_subnetwork.secondary_ip_range.1.range_name
  }

  # Removes the implicit default node pool, recommended when using
  # google_container_node_pool.
  remove_default_node_pool = true
  initial_node_count = 1

  # other settings...
}


# Linux node pool to run Linux-only Kubernetes Pods.
resource "google_container_node_pool" "linux_pool" {
  name               = "linux-pool"
  project            = google_container_cluster.genome_cluster.project
  cluster            = google_container_cluster.genome_cluster.name
  location           = google_container_cluster.genome_cluster.location


  autoscaling {
    min_node_count = "1"
    max_node_count = "5"
  }

  management {
    auto_repair  = "true"
    auto_upgrade = "true"
  }

  node_config {
    image_type   = "COS_CONTAINERD"
    machine_type = "n1-standard-1"
  }
}



# ---------------------------------------------------------------------------------------------------------------------
# DEPLOY A PRIVATE CLUSTER IN GOOGLE CLOUD PLATFORM
# ---------------------------------------------------------------------------------------------------------------------

module "gke_cluster" {
  # When using these modules in your own templates, you will need to use a Git URL with a ref attribute that pins you
  # to a specific version of the modules, such as the following example:
  source = "github.com/gruntwork-io/terraform-google-gke.git//modules/gke-cluster?ref=v0.2.0"
  # source = "./modules/gke-cluster"

  name = var.cluster_name

  project  = var.project
  location = var.location
  network  = module.vpc_network.network

  # Deploy the cluster in the 'private' subnetwork, outbound internet access will be provided by NAT
  # See the network access tier table for full details:
  # https://github.com/gruntwork-io/terraform-google-network/tree/master/modules/vpc-network#access-tier
  subnetwork = module.vpc_network.private_subnetwork

  # When creating a private cluster, the 'master_ipv4_cidr_block' has to be defined and the size must be /28
  master_ipv4_cidr_block = var.master_ipv4_cidr_block

  # This setting will make the cluster private
  enable_private_nodes = "true"

  # To make testing easier, we keep the public endpoint available. In production, we highly recommend restricting access to only within the network boundary, requiring your users to use a bastion host or VPN.
  disable_public_endpoint = "false"

  # With a private cluster, it is highly recommended to restrict access to the cluster master
  # However, for testing purposes we will allow all inbound traffic.
  master_authorized_networks_config = [
    {
      cidr_blocks = [
        {
          cidr_block   = "0.0.0.0/0"
          display_name = "all-for-testing"
        },
      ]
    },
  ]

  cluster_secondary_range_name = module.vpc_network.private_subnetwork_secondary_range_name
}

# ---------------------------------------------------------------------------------------------------------------------
# CREATE A NODE POOL
# ---------------------------------------------------------------------------------------------------------------------

resource "google_container_node_pool" "node_pool" {
  provider = google-beta

  name     = "main-pool"
  project  = var.project
  location = var.location
  cluster  = module.gke_cluster.name

  initial_node_count = "1"

  autoscaling {
    min_node_count = "1"
    max_node_count = "5"
  }

  management {
    auto_repair  = "true"
    auto_upgrade = "true"
  }

  node_config {
    image_type   = "COS"
    machine_type = "n1-standard-1"

    labels = {
      all-pools-example = "true"
    }

    # Add a private tag to the instances. See the network access tier table for full details:
    # https://github.com/gruntwork-io/terraform-google-network/tree/master/modules/vpc-network#access-tier
    tags = [
      module.vpc_network.private,
      "helm-example",
    ]

    disk_size_gb = "30"
    disk_type    = "pd-standard"
    preemptible  = false

    service_account = module.gke_service_account.email

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
  }

  lifecycle {
    ignore_changes = [initial_node_count]
  }

  timeouts {
    create = "30m"
    update = "30m"
    delete = "30m"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# CREATE A CUSTOM SERVICE ACCOUNT TO USE WITH THE GKE CLUSTER
# ---------------------------------------------------------------------------------------------------------------------

module "gke_service_account" {
  # When using these modules in your own templates, you will need to use a Git URL with a ref attribute that pins you
  # to a specific version of the modules, such as the following example:
  source = "github.com/gruntwork-io/terraform-google-gke.git//modules/gke-service-account?ref=v0.2.0"
  # source = "./modules/gke-service-account"

  name        = var.cluster_service_account_name
  project     = var.project
  description = var.cluster_service_account_description
}

# ---------------------------------------------------------------------------------------------------------------------
# CREATE A NETWORK TO DEPLOY THE CLUSTER TO
# ---------------------------------------------------------------------------------------------------------------------

resource "random_string" "suffix" {
  length  = 4
  special = false
  upper   = false
}

module "vpc_network" {
  source = "github.com/gruntwork-io/terraform-google-network.git//modules/vpc-network?ref=v0.4.0"

  name_prefix = "${var.cluster_name}-network-${random_string.suffix.result}"
  project     = var.project
  region      = var.region

  cidr_block           = var.vpc_cidr_block
  secondary_cidr_block = var.vpc_secondary_cidr_block
}

# ---------------------------------------------------------------------------------------------------------------------
# CONFIGURE KUBECTL AND RBAC ROLE PERMISSIONS
# ---------------------------------------------------------------------------------------------------------------------

# configure kubectl with the credentials of the GKE cluster
resource "null_resource" "configure_kubectl" {
  provisioner "local-exec" {
    command = "gcloud beta container clusters get-credentials ${module.gke_cluster.name} --region ${var.region} --project ${var.project}"

    # Use environment variables to allow custom kubectl config paths
    environment = {
      KUBECONFIG = var.kubectl_config_path != "" ? var.kubectl_config_path : ""
    }
  }

  depends_on = [google_container_node_pool.node_pool]
}

resource "kubernetes_cluster_role_binding" "user" {
  metadata {
    name = "admin-user"
  }

  role_ref {
    kind      = "ClusterRole"
    name      = "cluster-admin"
    api_group = "rbac.authorization.k8s.io"
  }

  subject {
    kind      = "User"
    name      = data.google_client_openid_userinfo.terraform_user.email
    api_group = "rbac.authorization.k8s.io"
  }

  subject {
    kind      = "Group"
    name      = "system:masters"
    api_group = "rbac.authorization.k8s.io"
  }
}




# ---------------------------------------------------------------------------------------------------------------------
# DEPLOY GenomeAI CHART
# A chart repository is a location where packaged charts can be stored and shared. Define Bitnami Helm repository location,
# so Helm can install the nginx chart.
# ---------------------------------------------------------------------------------------------------------------------


resource "kubernetes_namespace" "genome-namespace" {
  metadata {
    name = "local"
  }
}

resource "kubernetes_namespace" "genome-es-namespace" {
  metadata {
    name = "elastic-local"
  }
}

resource "kubernetes_namespace" "genome-argo-namespace" {
  metadata {
    name = "argo"
  }
}



# ---------------------------------------------------------------------------------------------------------------------
# DEPLOY Elastic ECK Operator and Elastic  Service
# ---------------------------------------------------------------------------------------------------------------------

resource "null_resource" "elastic_k8s_eck" {

  provisioner "local-exec" {
    command = "kubectl -- apply -f https://download.elastic.co/downloads/eck/1.2.0/all-in-one.yaml"

    environment = {
      BUCKET = "example.bucket"
    }
  }
}

resource "null_resource" "elastic_k8s" {

  provisioner "local-exec" {
    command = <<EOT
cat <<EOF | kubectl -- apply -f -
  apiVersion: elasticsearch.k8s.elastic.co/v1
  kind: Elasticsearch
  metadata:
    name: genome-a
    namespace: local
  spec:
    version: 7.8.1
    nodeSets:
    - name: default
      count: 1
      config:
        node.master: true
        node.data: true
        node.ingest: true


      volumeClaimTemplates:
      - metadata:
          name: elasticsearch-data
        spec:
          accessModes:
          - ReadWriteOnce
          resources:
            requests:
              storage: 7Gi
          storageClassName: standard
EOF
EOT
    environment = {
      BUCKET = "example.bucket"
    }

  }

  depends_on = [null_resource.elastic_k8s_eck]
}


resource "null_resource" "elastic_k8s_kibana" {
  provisioner "local-exec" {
    command = <<EOT
cat <<EOF | kubectl -- apply -f -
  apiVersion: kibana.k8s.elastic.co/v1
  kind: Kibana
  metadata:
    name: genome-a
    namespace: local
  spec:
    version: 7.8.1
    count: 1
    elasticsearchRef:
      name: genome-a
EOF
EOT
    environment = {
      BUCKET = "example.bucket"
    }
  }

  depends_on = [null_resource.elastic_k8s]
}


# ------------------------------------------------------
# Deploy Genome ARGO
# ------------------------------------------------------

resource "null_resource" "argo_k8s" {

  provisioner "local-exec" {
    command = "kubectl -- apply -n argo -f https://raw.githubusercontent.com/argoproj/argo-workflows/v3.0.6/manifests/namespace-install.yaml"

    environment = {
      BUCKET = "example.bucket"
    }
  }
}



resource "helm_release" "genome_services" {
  depends_on = [google_container_node_pool.node_pool]

  name       = "genome"
  chart      = "../helm"
}


# ---------------------------------------------------------------------------------------------------------------------
# DEPLOY Elastic ECK Operator and Elastic  Service
# ---------------------------------------------------------------------------------------------------------------------

resource "null_resource" "elastic_k8s_eck" {

  provisioner "local-exec" {
    command = "kubectl apply -f https://download.elastic.co/downloads/eck/1.2.0/all-in-one.yaml"

    environment = {
      BUCKET = "example.bucket"
    }
  }
}

resource "null_resource" "elastic_k8s" {

  provisioner "local-exec" {
    command = <<EOT
cat <<EOF | kubectl apply -f -
  apiVersion: elasticsearch.k8s.elastic.co/v1
  kind: Elasticsearch
  metadata:
    name: genome-es
  spec:
    version: 7.8.1
    nodeSets:
    - name: default
      count: 1
      config:
        node.master: true
        node.data: true
        node.ingest: true
        node.store.allow_mmap: false
EOF
EOT
    environment = {
      BUCKET = "example.bucket"
    }

  }

  depends_on = [null_resource.elastic_k8s_eck]

}


resource "helm_release" "genome_local" {
  name  = "genome-a"
  chart = "../helm"
  namespace = "local"

  values = [
    "${file("../helm/values/local-values.yaml")}"
  ]

  depends_on = [null_resource.elastic_k8s]

}

resource "null_resource" "elastic_index_ready" {
  provisioner "local-exec" {
    command = "kubectl -- wait -n local --for=condition=complete job/initialize-index --timeout=600s"
  }

  depends_on = [helm_release.genome_local]
}

resource "null_resource" "elastic_validation_index_ready" {
  provisioner "local-exec" {
    command = "kubectl -- wait -n local --for=condition=complete job/initialize-validation-index --timeout=600s"
  }

  depends_on = [helm_release.genome_local]
}

resource "null_resource" "elastic_deployment_index_ready" {
  provisioner "local-exec" {
    command = "kubectl -- wait -n local --for=condition=complete job/initialize-deployment-index --timeout=600s"
  }

  depends_on = [helm_release.genome_local]
}




# ---------------------------------------------------------------------------------------------------------------------
# WORKAROUNDS
# ---------------------------------------------------------------------------------------------------------------------

# This is a workaround for the Kubernetes and Helm providers as Terraform doesn't currently support passing in module
# outputs to providers directly.
data "template_file" "gke_host_endpoint" {
  template = module.gke_cluster.endpoint
}

data "template_file" "access_token" {
  template = data.google_client_config.client.access_token
}

data "template_file" "cluster_ca_certificate" {
  template = module.gke_cluster.cluster_ca_certificate
}
