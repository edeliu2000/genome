variable "project_id" {
  description = "The project ID to host the cluster in"
}
variable "cluster_name" {
  description = "The name for the GKE cluster"
  default     = "genome"
}
variable "env_name" {
  description = "The environment for the GKE cluster"
  default     = "prod"
}
variable "region" {
  description = "The region to host the cluster in"
  default     = "us-west1"
}
variable "regional" {
  description = "use regional or zonal cluster with lower cost"
  default     = true
}
variable "zones" {
  description = "The region to host the cluster in"
  default     = "us-west1-a"
}
variable "service_account" {
  type        = string
  description = "The service account to run nodes as if not overridden in `node_pools`. The create_service_account variable default value (true) will cause a cluster-specific service account to be created."
}
variable "network" {
  description = "The VPC network created to host the cluster in"
  default     = "gke-network"
}
variable "subnetwork" {
  description = "The subnetwork created to host the cluster in"
  default     = "gke-subnet"
}
variable "ip_range_pods_name" {
  description = "The secondary ip range to use for pods"
  default     = "ip-range-pods"
}
variable "ip_range_services_name" {
  description = "The secondary ip range to use for services"
  default     = "ip-range-services"
}
variable "preemptible" {
  description = "use preemptible nodes with lower cost"
  default     = false
}
