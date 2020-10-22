terraform {
  # The modules used in this example have been updated with 0.12 syntax, additionally we depend on a bug fixed in
  # version 0.12.7.
  required_version = ">= 0.12.7"
}

provider "kubernetes" {
  config_context_cluster = "minikube"
}

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
    command = "minikube kubectl -- apply -f https://download.elastic.co/downloads/eck/1.2.0/all-in-one.yaml"

    environment = {
      BUCKET = "example.bucket"
    }
  }
}

resource "null_resource" "elastic_k8s" {

  provisioner "local-exec" {
    command = <<EOT
cat <<EOF | minikube kubectl -- apply -f -
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
cat <<EOF | minikube kubectl -- apply -f -
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
    command = "minikube kubectl -- apply -n argo -f https://raw.githubusercontent.com/argoproj/argo/stable/manifests/install.yaml"

    environment = {
      BUCKET = "example.bucket"
    }
  }
}


# ------------------------------------------------------
# Deploy All other K8 of Genome Services AFTER Elastic
# ------------------------------------------------------

provider "helm" {
  kubernetes {
    config_context_cluster = "minikube"
  }
}

resource "helm_release" "genome_local" {
  name  = "genome-a"
  chart = "../../helm"
  namespace = "local"

  values = [
    "${file("../../helm/values/local-values.yaml")}"
  ]

  depends_on = [null_resource.elastic_k8s]

}

resource "null_resource" "elastic_index_ready" {
  provisioner "local-exec" {
    command = "minikube kubectl -- wait -n local --for=condition=complete job/initialize-index --timeout=600s"
  }

  depends_on = [helm_release.genome_local]
}
