module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids

  eks_managed_node_groups = {
    main = {
      desired_size   = var.node_desired_capacity
      max_size       = var.node_max_capacity
      min_size       = var.node_min_capacity
      instance_types = [var.node_instance_type]

      labels = {
        role    = "worker"
        project = var.project_tag
      }

      tags = {
        ExtraTag = "microservices-node"
      }
    }
  }

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Enable EKS add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  tags = {
    Project     = var.project_tag
    Environment = var.environment
  }
}