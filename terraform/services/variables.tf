
variable "cluster_name" {
    default = ""
}

variable "env_name" {
    default = "local"
}

variable "app_name" {
    default = "genome-a"
}

variable "app_namespace" {
    default = "app_local"
}

variable "kube_command" {
    default = "kubectl"
}

variable "cluster_config_file" {
    default = "~/.kube/config"
}

variable "elastic_crd_count" {
    default = 1
}
