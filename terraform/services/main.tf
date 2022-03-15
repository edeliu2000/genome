
terraform {
  # The modules used in this example have been updated with 0.12 syntax, additionally we depend on a bug fixed in
  # version 0.12.7.
  required_version = ">= 0.12.7"

  required_providers {
      helm       = "= 2.3.0"  # https://github.com/hashicorp/terraform-provider-helm/releases
      kubernetes = "= 2.5.0" # https://github.com/hashicorp/terraform-provider-kubernetes/releases
    }
}


provider "kubernetes" {
  config_path = "${var.cluster_config_file}"
}

provider "helm" {
  kubernetes {
    config_path = "${var.cluster_config_file}"

  }
}


# ---------------------------------------------------------------------------------------------------------------------
# DEPLOY K8 Namespaces for Services
# ---------------------------------------------------------------------------------------------------------------------


resource "kubernetes_namespace" "genome-namespace" {
  metadata {
    name = "${var.app_namespace}"
  }
}

resource "kubernetes_namespace" "genome-es-namespace" {
  metadata {
    name = "elastic-${var.app_namespace}"
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

resource "null_resource" "elastic_k8s_eck_crds" {
  count = "${var.elastic_crd_count}"

  provisioner "local-exec" {
    command = "${var.kube_command} create -f https://download.elastic.co/downloads/eck/1.8.0/crds.yaml"

    environment = {
      BUCKET = "example.bucket"
    }
  }

  depends_on = [kubernetes_namespace.genome-namespace]
}

resource "null_resource" "elastic_k8s_eck" {

  provisioner "local-exec" {
    command = "${var.kube_command} apply -f https://download.elastic.co/downloads/eck/1.8.0/operator.yaml"

    environment = {
      BUCKET = "example.bucket"
    }
  }

  depends_on = [null_resource.elastic_k8s_eck_crds]
}

resource "null_resource" "elastic_k8s" {

  provisioner "local-exec" {
    command = <<EOT
cat <<EOF | ${var.kube_command} apply -f -
  apiVersion: elasticsearch.k8s.elastic.co/v1
  kind: Elasticsearch
  metadata:
    name: ${var.app_name}
    namespace: ${var.app_namespace}
  spec:
    version: 7.15.0
    nodeSets:
    - config:
        node.master: true
        node.data: true
        node.ingest: true

      name: default
      count: 1

      podTemplate:
        metadata:
          annotations:
            elasticsearch.check_names: '["elastic"]'
            elasticsearch.init_configs: '[{}]'
        spec:
          containers:
          - env:
            - name: ES_JAVA_OPTS
              value: -Xms1g -Xmx1g
            name: elasticsearch
            resources:
              limits:
                cpu: 500m
                memory: 2Gi
              requests:
                cpu: 500m
                memory: 2Gi
          initContainers:
          - command:
            - sh
            - -c
            - sysctl -w vm.max_map_count=262144
            name: set-max-map-count
            securityContext:
              privileged: true

      volumeClaimTemplates:
      - metadata:
          name: elasticsearch-data
        spec:
          accessModes:
          - ReadWriteOnce
          resources:
            requests:
              storage: 16Gi
          storageClassName: standard
EOF
EOT
    environment = {
      BUCKET = "example.bucket"
    }

  }

  depends_on = [null_resource.elastic_k8s_eck, kubernetes_namespace.genome-namespace]
}


resource "null_resource" "elastic_k8s_kibana" {
  provisioner "local-exec" {
    command = <<EOT
cat <<EOF | ${var.kube_command} apply -f -
  apiVersion: kibana.k8s.elastic.co/v1
  kind: Kibana
  metadata:
    name: ${var.app_name}
    namespace: ${var.app_namespace}
  spec:
    version: 7.15.0
    count: 1
    elasticsearchRef:
      name: ${var.app_name}
EOF
EOT
    environment = {
      BUCKET = "example.bucket"
    }
  }

  depends_on = [null_resource.elastic_k8s, kubernetes_namespace.genome-namespace]
}


# ------------------------------------------------------
# Deploy Genome ARGO
# ------------------------------------------------------

resource "null_resource" "argo_k8s" {

  provisioner "local-exec" {
    command = "${var.kube_command} apply -n argo -f https://raw.githubusercontent.com/argoproj/argo-workflows/v3.0.6/manifests/namespace-install.yaml"

    environment = {
      BUCKET = "example.bucket"
    }
  }

  depends_on = [kubernetes_namespace.genome-argo-namespace]
}


# ------------------------------------------------------
# Deploy All other K8 of Genome Services AFTER Elastic
# ------------------------------------------------------

resource "helm_release" "genome_ai" {
  name  = "${var.app_name}"
  chart = "../helm"
  namespace = "${var.app_namespace}"

  values = [
    "${file(format("%s/%s-values.yaml", "../helm/values", var.env_name))}"
  ]

  depends_on = [null_resource.elastic_k8s, kubernetes_namespace.genome-namespace]

}

resource "null_resource" "elastic_index_ready" {
  provisioner "local-exec" {
    command = "${var.kube_command} wait -n ${var.app_namespace} --for=condition=complete job/initialize-index --timeout=600s"
  }

  depends_on = [helm_release.genome_ai]
}

resource "null_resource" "elastic_validation_index_ready" {
  provisioner "local-exec" {
    command = "${var.kube_command} wait -n ${var.app_namespace} --for=condition=complete job/initialize-validation-index --timeout=600s"
  }

  depends_on = [helm_release.genome_ai]
}

resource "null_resource" "elastic_deployment_index_ready" {
  provisioner "local-exec" {
    command = "${var.kube_command} wait -n ${var.app_namespace} --for=condition=complete job/initialize-deployment-index --timeout=600s"
  }

  depends_on = [helm_release.genome_ai]
}
