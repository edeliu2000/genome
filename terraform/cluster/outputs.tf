output "cluster_name" {
  description = "Cluster name"
  value       = module.gke.name
}

output "cluster_conf" {
  value       = local_file.kubeconfig.filename
}
