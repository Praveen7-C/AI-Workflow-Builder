# SETUP.md — Complete Deployment Guide

This guide covers everything from local development to production-grade deployment with containers, Kubernetes, monitoring, and centralized logging. Each section is written so that a beginner can follow along step by step.

---

## Table of Contents

1. [Local Development Setup](#1-local-development-setup)
2. [Docker — Containerization](#2-docker--containerization)
3. [Kubernetes — Local Cluster with Minikube](#3-kubernetes--local-cluster-with-minikube)
4. [Kubernetes — Cloud Deployment](#4-kubernetes--cloud-deployment)
5. [Monitoring — Prometheus and Grafana](#5-monitoring--prometheus-and-grafana)
6. [Logging — ELK Stack](#6-logging--elk-stack)
7. [Required Code Changes](#7-required-code-changes)

---

## 1. Local Development Setup

### What you need to install first

| Tool | Why | Download |
|------|-----|----------|
| Python 3.10+ | Runs the backend | https://python.org/downloads |
| Node.js 18+ | Runs the frontend | https://nodejs.org |
| Git | Clone the repository | https://git-scm.com |

### Step 1 — Clone the project

```bash
git clone https://github.com/your-username/ai-workflow-builder.git
cd ai-workflow-builder
```

### Step 2 — Create a Supabase project

The backend uses **Supabase** (PostgreSQL) as its database. You must set this up before running the app.

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, give it a name, choose a region, and set a database password.
3. Once the project is ready, go to **SQL Editor** in the left sidebar.
4. Click **New Query**, paste the entire contents of `Backend/supabase_migration.sql`, and click **Run**.
   This creates all the required tables: `users`, `workflows`, `chat_logs`, `custom_avatars`, and the `avatars` storage bucket.
5. Go to **Settings > API** and note down:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public key** (starts with `eyJhbGci...`)
   - **service_role key** (also starts with `eyJhbGci...` — keep this secret)

### Step 3 — Set up the backend

```bash
cd Backend

# Create a Python virtual environment
python -m venv venv

# Activate it
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

# Install all required packages
pip install -r requirements.txt
```

Create your backend environment file:

```bash
cp .env.example .env
```

Open `Backend/.env` in any text editor and fill in these values:

```env
# Generate with:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=your_generated_fernet_key_here

# Generate with:
# python -c "import uuid; print(str(uuid.uuid4()))"
JWT_SECRET=your_random_secret_here

# From Supabase Dashboard > Settings > API
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGci...          # anon key
SUPABASE_SERVICE_KEY=eyJhbGci... # service_role key

CHROMA_PERSIST_DIR=./chroma_db

# Only needed if you want Google Sign-In
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx

FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
```

Start the backend:

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. Open `http://localhost:8000/docs` to see the interactive API documentation.

### Step 4 — Set up the frontend

Open a new terminal window (keep the backend running in the first one):

```bash
cd Frontend
npm install
cp .env.example .env
```

Open `Frontend/.env` and set:

```env
VITE_BACKEND_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. You should see the application running.

### Step 5 — (Optional) Set up Google OAuth

If you want users to be able to sign in with their Google account:

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create or select a project.
2. Enable the **Google Identity API** under APIs & Services > Library.
3. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**.
4. Application type: **Web application**.
5. Add these to **Authorized Redirect URIs**:
   - `http://localhost:8000/api/user/google/callback` (for local development)
   - `https://your-backend-domain.com/api/user/google/callback` (for production)
6. Copy the **Client ID** and **Client Secret** into your `Backend/.env`.

---

## 2. Docker — Containerization

Docker packages your app and all its dependencies into a container so it runs the same way on any machine.

### What you need to install

Download and install Docker Desktop from https://docs.docker.com/get-docker/

After installing, verify it works:

```bash
docker --version
docker compose version
```

### Step 1 — Create the Backend Dockerfile

Create the file `Backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system build tools needed by some Python packages
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (better Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 2 — Create the Frontend Dockerfile

Create the file `Frontend/Dockerfile`:

```dockerfile
# Stage 1: Build the React/Vite application
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# The backend URL is baked in at build time
ARG VITE_BACKEND_URL=http://localhost:8000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

# Stage 2: Serve the built files with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Step 3 — Create the nginx config for the frontend

Create the file `Frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Send all routes to index.html so React Router works correctly
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Step 4 — Create the Docker Compose file

Create `docker-compose.yml` at the root of the project:

```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./Backend
      dockerfile: Dockerfile
    container_name: ai-workflow-backend
    ports:
      - "8000:8000"
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - CHROMA_PERSIST_DIR=/app/chroma_db
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
      - BACKEND_URL=${BACKEND_URL}
    volumes:
      # ChromaDB vector store persists across container restarts
      - chroma_data:/app/chroma_db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./Frontend
      dockerfile: Dockerfile
      args:
        - VITE_BACKEND_URL=http://localhost:8000
    container_name: ai-workflow-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  chroma_data:
```

> **Note:** Supabase is a cloud-hosted PostgreSQL service. There is no database container to run locally — the app connects to your Supabase project over the internet.

Create a `.env` file at the project root (Docker Compose reads this automatically):

```env
ENCRYPTION_KEY=your_fernet_key_here
JWT_SECRET=your_jwt_secret_here
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
FRONTEND_URL=http://localhost
BACKEND_URL=http://localhost:8000
```

### Step 5 — Build and run with Docker

```bash
# Build all images and start all containers
docker compose up --build

# To run in the background
docker compose up --build -d

# To stop everything
docker compose down

# To view logs
docker compose logs -f backend
docker compose logs -f frontend
```

The application will be available at `http://localhost`.

---

## 3. Kubernetes — Local Cluster with Minikube

Kubernetes orchestrates your containers at scale. Minikube runs a single-node Kubernetes cluster on your laptop for local testing.

### What you need to install

**kubectl** — the Kubernetes command-line tool:

```bash
# macOS
brew install kubectl

# Windows (run PowerShell as Administrator)
winget install Kubernetes.kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/
```

**Minikube**:

```bash
# macOS
brew install minikube

# Windows
winget install Kubernetes.minikube

# Linux
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

### Step 1 — Start Minikube

```bash
minikube start

# Verify the cluster is running
kubectl get nodes
# You should see one node with STATUS = Ready
```

### Step 2 — Create Kubernetes manifest files

Create a `k8s/` folder at the root of the project, then create the files below.

**`k8s/namespace.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-workflow
```

**`k8s/secrets.yaml`**

Kubernetes Secrets store sensitive values as base64-encoded strings. To encode a value:

```bash
echo -n "your_actual_value" | base64
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: ai-workflow
type: Opaque
data:
  # Replace each value with your base64-encoded secret
  ENCRYPTION_KEY: <base64-encoded-fernet-key>
  JWT_SECRET: <base64-encoded-jwt-secret>
  SUPABASE_URL: <base64-encoded-supabase-url>
  SUPABASE_KEY: <base64-encoded-anon-key>
  SUPABASE_SERVICE_KEY: <base64-encoded-service-role-key>
  GOOGLE_CLIENT_ID: <base64-encoded-client-id>
  GOOGLE_CLIENT_SECRET: <base64-encoded-client-secret>
```

**`k8s/backend-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: ai-workflow
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: ai-workflow-backend:latest
          imagePullPolicy: Never   # Use locally built image in Minikube
          ports:
            - containerPort: 8000
          env:
            - name: ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: ENCRYPTION_KEY
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: JWT_SECRET
            - name: SUPABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: SUPABASE_URL
            - name: SUPABASE_KEY
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: SUPABASE_KEY
            - name: SUPABASE_SERVICE_KEY
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: SUPABASE_SERVICE_KEY
            - name: CHROMA_PERSIST_DIR
              value: "/app/chroma_db"
          volumeMounts:
            - name: chroma-storage
              mountPath: /app/chroma_db
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 15
      volumes:
        - name: chroma-storage
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: ai-workflow
  labels:
    app: backend
spec:
  selector:
    app: backend
  ports:
    - protocol: TCP
      port: 8000
      targetPort: 8000
  type: ClusterIP
```

**`k8s/frontend-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: ai-workflow
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: ai-workflow-frontend:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: ai-workflow
spec:
  selector:
    app: frontend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
  type: NodePort
```

### Step 3 — Build images inside Minikube and deploy

```bash
# Point Docker to Minikube's internal daemon so images are visible to the cluster
eval $(minikube docker-env)

# Build images
docker build -t ai-workflow-backend:latest ./Backend
docker build -t ai-workflow-frontend:latest ./Frontend \
  --build-arg VITE_BACKEND_URL=http://$(minikube ip):8000

# Apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Check pods are running (allow 30-60 seconds for startup)
kubectl get pods -n ai-workflow

# Get the URL to open the frontend
minikube service frontend-service -n ai-workflow --url
```

### Useful debugging commands

```bash
# See everything running in the namespace
kubectl get all -n ai-workflow

# View backend logs
kubectl logs -n ai-workflow deployment/backend

# Open a shell inside the backend pod
kubectl exec -it -n ai-workflow deployment/backend -- /bin/sh

# See why a pod might be failing
kubectl describe pod -n ai-workflow -l app=backend
```

---

## 4. Kubernetes — Cloud Deployment

### Option A — AWS EKS (Amazon Elastic Kubernetes Service)

**Prerequisites:**
- AWS account: https://aws.amazon.com/free
- AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html
- eksctl: https://eksctl.io/introduction/#installation

**Step 1 — Configure AWS CLI**

```bash
aws configure
# Enter: AWS Access Key ID, Secret Access Key, region (e.g. ap-south-1), output format: json
```

**Step 2 — Create an EKS cluster**

```bash
# This takes 10-15 minutes
eksctl create cluster \
  --name ai-workflow-cluster \
  --region ap-south-1 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3 \
  --managed

# Verify kubectl is connected
kubectl get nodes
```

**Step 3 — Push Docker images to Amazon ECR**

```bash
# Create ECR repositories
aws ecr create-repository --repository-name ai-workflow-backend --region ap-south-1
aws ecr create-repository --repository-name ai-workflow-frontend --region ap-south-1

# Authenticate Docker with ECR
aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin \
    YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com

# Build and push backend
docker build -t ai-workflow-backend ./Backend
docker tag ai-workflow-backend:latest \
  YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/ai-workflow-backend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/ai-workflow-backend:latest

# Build and push frontend
docker build -t ai-workflow-frontend ./Frontend \
  --build-arg VITE_BACKEND_URL=https://your-backend-domain.com
docker tag ai-workflow-frontend:latest \
  YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/ai-workflow-frontend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/ai-workflow-frontend:latest
```

**Step 4 — Update image references in manifests**

In `k8s/backend-deployment.yaml`, change:

```yaml
# FROM (local):
image: ai-workflow-backend:latest
imagePullPolicy: Never

# TO (ECR):
image: YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/ai-workflow-backend:latest
imagePullPolicy: Always
```

Do the same for the frontend deployment.

**Step 5 — Deploy**

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Get the external load balancer address
kubectl get svc -n ai-workflow
```

**Step 6 — Clean up to avoid charges**

```bash
eksctl delete cluster --name ai-workflow-cluster --region ap-south-1
```

---

### Option B — Google GKE (Google Kubernetes Engine)

**Prerequisites:**
- Google Cloud account: https://console.cloud.google.com
- Google Cloud CLI: https://cloud.google.com/sdk/docs/install

**Step 1 — Set up gcloud**

```bash
gcloud init
gcloud auth configure-docker
```

**Step 2 — Create a GKE cluster**

```bash
gcloud services enable container.googleapis.com

gcloud container clusters create ai-workflow-cluster \
  --zone asia-south1-a \
  --num-nodes 2 \
  --machine-type e2-standard-2

# Connect kubectl to the new cluster
gcloud container clusters get-credentials ai-workflow-cluster --zone asia-south1-a
```

**Step 3 — Push images to Google Artifact Registry**

```bash
gcloud services enable artifactregistry.googleapis.com

gcloud artifacts repositories create ai-workflow \
  --repository-format=docker \
  --location=asia-south1

# Build and push backend
docker build -t asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/ai-workflow/backend:latest ./Backend
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/ai-workflow/backend:latest

# Build and push frontend
docker build -t asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/ai-workflow/frontend:latest ./Frontend \
  --build-arg VITE_BACKEND_URL=https://your-backend-domain.com
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/ai-workflow/frontend:latest
```

**Step 4 — Deploy to GKE**

Update the image references in your manifests to the Artifact Registry paths, then:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

kubectl get svc -n ai-workflow
```

**Step 5 — Clean up**

```bash
gcloud container clusters delete ai-workflow-cluster --zone asia-south1-a
```

---

## 5. Monitoring — Prometheus and Grafana

Prometheus collects metrics (numbers about your app's performance). Grafana turns those metrics into visual dashboards.

### Step 1 — Install Helm

Helm is the package manager for Kubernetes.

```bash
# macOS
brew install helm

# Windows
winget install Helm.Helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Step 2 — Install Prometheus and Grafana on Kubernetes

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install the full monitoring stack (Prometheus + Grafana + Alertmanager)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=admin123

# Wait for everything to start (takes a few minutes)
kubectl get pods -n monitoring
```

### Step 3 — Expose the /metrics endpoint on the backend

See **Section 7, Change 1** for the exact code change to `Backend/main.py`. After making the change, rebuild your Docker image.

### Step 4 — Tell Prometheus to scrape the backend

Create `k8s/monitoring/servicemonitor.yaml`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  namespaceSelector:
    matchNames:
      - ai-workflow
  selector:
    matchLabels:
      app: backend
  endpoints:
    - port: "8000"
      path: /metrics
      interval: 15s
```

Apply it:

```bash
kubectl apply -f k8s/monitoring/servicemonitor.yaml
```

### Step 5 — Access Grafana

```bash
# Forward port 3000 to your machine
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

Open `http://localhost:3000` in your browser. Username: `admin`, Password: `admin123`.

Import these dashboards by going to **+** > **Import** and entering the dashboard ID:
- **1860** — Node Exporter Full (server and container metrics)
- **7587** — FastAPI metrics

### Step 6 — Prometheus and Grafana with Docker Compose (without Kubernetes)

Add to your `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

volumes:
  grafana_data:
```

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "backend"
    static_configs:
      - targets: ["backend:8000"]
    metrics_path: /metrics
```

---

## 6. Logging — ELK Stack

ELK stands for Elasticsearch (stores logs), Logstash (processes logs), and Kibana (visualizes logs). Together they give you a searchable, visual view of all application logs.

### Step 1 — Add structured JSON logging to the backend

See **Section 7, Change 2** for the exact code to add to `Backend/main.py`. This makes the backend emit logs in JSON format, which Logstash can parse automatically.

### Step 2 — Deploy ELK with Docker Compose

Add to your `docker-compose.yml`:

```yaml
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    restart: unless-stopped

  logstash:
    image: docker.elastic.co/logstash/logstash:8.12.0
    container_name: logstash
    ports:
      - "5044:5044"
    volumes:
      - ./monitoring/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch
    restart: unless-stopped

  kibana:
    image: docker.elastic.co/kibana/kibana:8.12.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
    restart: unless-stopped

  filebeat:
    image: docker.elastic.co/beats/filebeat:8.12.0
    container_name: filebeat
    user: root
    volumes:
      - ./monitoring/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - logstash
    restart: unless-stopped

volumes:
  elasticsearch_data:
```

Create `monitoring/logstash.conf`:

```
input {
  beats {
    port => 5044
  }
}

filter {
  json {
    source => "message"
    skip_on_invalid_json => true
  }
  date {
    match => ["timestamp", "ISO8601"]
    target => "@timestamp"
  }
}

output {
  elasticsearch {
    hosts => ["http://elasticsearch:9200"]
    index => "ai-workflow-logs-%{+YYYY.MM.dd}"
  }
}
```

Create `monitoring/filebeat.yml`:

```yaml
filebeat.inputs:
  - type: container
    paths:
      - /var/lib/docker/containers/*/*.log
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"

output.logstash:
  hosts: ["logstash:5044"]

logging.level: warning
```

Access Kibana at `http://localhost:5601`. Go to **Discover**, create an index pattern `ai-workflow-logs-*`, and start exploring your logs.

### Step 3 — Deploy ELK on Kubernetes

Create `k8s/logging/elasticsearch.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: logging
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elasticsearch
  namespace: logging
spec:
  replicas: 1
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
        - name: elasticsearch
          image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
          env:
            - name: discovery.type
              value: single-node
            - name: xpack.security.enabled
              value: "false"
            - name: ES_JAVA_OPTS
              value: "-Xms512m -Xmx512m"
          ports:
            - containerPort: 9200
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "1"
---
apiVersion: v1
kind: Service
metadata:
  name: elasticsearch
  namespace: logging
spec:
  selector:
    app: elasticsearch
  ports:
    - port: 9200
      targetPort: 9200
```

Create `k8s/logging/kibana.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kibana
  namespace: logging
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kibana
  template:
    metadata:
      labels:
        app: kibana
    spec:
      containers:
        - name: kibana
          image: docker.elastic.co/kibana/kibana:8.12.0
          env:
            - name: ELASTICSEARCH_HOSTS
              value: "http://elasticsearch:9200"
          ports:
            - containerPort: 5601
---
apiVersion: v1
kind: Service
metadata:
  name: kibana
  namespace: logging
spec:
  selector:
    app: kibana
  ports:
    - port: 5601
      targetPort: 5601
  type: NodePort
```

Deploy:

```bash
kubectl apply -f k8s/logging/elasticsearch.yaml
kubectl apply -f k8s/logging/kibana.yaml

# Access Kibana
kubectl port-forward -n logging svc/kibana 5601:5601
# Open http://localhost:5601
```

---

## 7. Required Code Changes

This section gives you the exact code to add or modify for monitoring and logging to work. All changes are in `Backend/main.py` unless otherwise noted.

---

### Change 1 — Add the Prometheus /metrics endpoint

**First, add the package to `Backend/requirements.txt`:**

Open the file and add this line at the end:

```
prometheus-fastapi-instrumentator==6.1.0
```

**Then update `Backend/main.py`:**

Find the existing imports at the very top of the file:

```python
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import workflow, run, user, kb
from db.database import init_db
import os
```

Add one new import line directly after the existing ones:

```python
from prometheus_fastapi_instrumentator import Instrumentator
```

Then find where `app` is created:

```python
app = FastAPI(
    title="GenAI Stack Backend",
    description="Backend with Supabase for AI workflows, knowledge bases, and chat.",
    version="2.0.0",
)
```

Add these two lines immediately after the closing parenthesis of `FastAPI(...)`:

```python
# Expose Prometheus metrics at /metrics
Instrumentator().instrument(app).expose(app)
```

After this change, your backend will serve Prometheus metrics at `http://localhost:8000/metrics`. Prometheus will scrape this endpoint every 15 seconds.

---

### Change 2 — Add structured JSON logging

This makes every log line a JSON object so Logstash can parse it automatically.

In `Backend/main.py`, add this block **after the imports but before `app = FastAPI(...)`**:

```python
import logging
import json
import sys
from datetime import datetime


class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON for ELK Stack ingestion."""
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


# Replace the default logging handler with our JSON formatter
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(JSONFormatter())
logging.root.setLevel(logging.INFO)
logging.root.handlers = [_handler]

logger = logging.getLogger(__name__)
```

Then update the existing `on_startup` function to include a startup log message:

```python
# FIND this existing function:
@app.on_event("startup")
def on_startup():
    init_db()

# REPLACE it with:
@app.on_event("startup")
def on_startup():
    init_db()
    logger.info("Application started — connected to Supabase")
```

---

### Change 3 — Add request logging middleware

This logs every HTTP request with its method, path, status code, and response time.

Add this block to `Backend/main.py` **after the CORS middleware block** (after the `app.add_middleware(CORSMiddleware, ...)` call):

```python
import time
from fastapi import Request


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every incoming HTTP request with timing information."""
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(json.dumps({
        "event": "http_request",
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "duration_ms": duration_ms,
    }))
    return response
```

---

### Change 4 — Improve the health check endpoint

The current health check returns a simple `{"status": "ok"}`. Replace it with one that also checks whether Supabase and ChromaDB are reachable, which Kubernetes liveness probes can use to detect real failures.

Find the existing health check in `Backend/main.py`:

```python
@app.get("/health")
async def health():
    return {"status": "ok"}
```

Replace it with:

```python
import httpx as _httpx
import os as _os


@app.get("/health")
async def health():
    """
    Health check used by Kubernetes liveness probes and Docker healthcheck.
    Verifies that Supabase and ChromaDB are reachable.
    """
    checks = {"status": "ok", "supabase": "ok", "vector_store": "ok"}

    # Check Supabase connectivity
    try:
        supabase_url = _os.getenv("SUPABASE_URL", "")
        service_key = _os.getenv("SUPABASE_SERVICE_KEY", "")
        async with _httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{supabase_url}/rest/v1/",
                headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
            )
            if r.status_code not in (200, 400):  # 400 = no table specified, still reachable
                raise Exception(f"HTTP {r.status_code}")
    except Exception as e:
        checks["supabase"] = f"error: {str(e)}"
        checks["status"] = "degraded"

    # Check ChromaDB
    try:
        from utils.chroma_client import get_chroma_client
        client = get_chroma_client()
        client.heartbeat()
    except Exception as e:
        checks["vector_store"] = f"error: {str(e)}"
        checks["status"] = "degraded"

    return checks
```

---

### Change 5 — Fix CORS for production

The current `main.py` includes `"*"` in the allowed origins, which permits any website to call your API. This must be locked down before going to production.

Find the `origins` list in `Backend/main.py`:

```python
origins = [
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "*",
]
```

Replace it with:

```python
# Read allowed origins from the environment variable.
# In production, set ALLOWED_ORIGINS=https://your-frontend-domain.com
# Multiple origins can be comma-separated: https://app.example.com,https://www.example.com
_allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
origins = [o.strip() for o in _allowed.split(",") if o.strip()]
```

Then add `ALLOWED_ORIGINS` to your `Backend/.env`:

```env
# Development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Production (replace with your actual domain)
# ALLOWED_ORIGINS=https://your-app.com
```

---

### Change 6 — Create .env.example files

These templates let other developers know which variables to set without exposing real values.

Create `Backend/.env.example`:

```env
# REQUIRED — Generate with:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=

# REQUIRED — Generate with:
# python -c "import uuid; print(str(uuid.uuid4()))"
JWT_SECRET=

# REQUIRED — Supabase project credentials
# Get from: Supabase Dashboard > Settings > API
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=
SUPABASE_SERVICE_KEY=

# OPTIONAL — ChromaDB vector store path (default: ./chroma_db)
CHROMA_PERSIST_DIR=./chroma_db

# OPTIONAL — Google OAuth (only needed if enabling Google Sign-In)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OPTIONAL — Used for OAuth redirects and CORS
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000

# OPTIONAL — Comma-separated list of allowed CORS origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

Create `Frontend/.env.example`:

```env
VITE_BACKEND_URL=http://localhost:8000
```

---

### Change 7 — Create .dockerignore files

These prevent large and unnecessary files from being copied into Docker images.

Create `Backend/.dockerignore`:

```
__pycache__/
*.pyc
*.pyo
*.pyd
venv/
.env
chroma_db/
*.egg-info/
.git/
.gitignore
```

Create `Frontend/.dockerignore`:

```
node_modules/
dist/
.env
.git/
*.log
```

---

## Summary of New Files to Create

```
project-root/
├── docker-compose.yml
├── .env
├── k8s/
│   ├── namespace.yaml
│   ├── secrets.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── monitoring/
│   │   └── servicemonitor.yaml
│   └── logging/
│       ├── elasticsearch.yaml
│       └── kibana.yaml
├── monitoring/
│   ├── prometheus.yml
│   ├── logstash.conf
│   └── filebeat.yml
├── Backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env.example
└── Frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── .dockerignore
    └── .env.example
```

---

For questions or issues, open a [GitHub Issue](../../issues).
