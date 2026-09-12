# Loveable Project Flow - Hinglish Senior Engineer Guide

Ye README fresher-friendly hai. Iska goal hai ki tumhe crystal clear ho:

- Developer kaha se start karega.
- Kaunsi file/function kis kaam ke liye hai.
- Docker image kab rebuild karni hai.
- Kubernetes me kaunsa deployment/service/pod banta hai.
- Runtime pod ke andar kaunse containers run hote hain.
- Browser request kis port/service/function tak jaati hai.
- Har flow ko test kaise karna hai.

Important: `k8s/secrets.yml` me real local secrets ho sakte hain. Is file ko commit/share mat karna. Secret names samajhne ke liye `k8s/secrets.example.yml` dekho.

## 0. Pehle Basic Words Clear Karo

Is project ko samajhne se pehle ye words clear hone chahiye. README me jab bhi ye words aaye, inka ye meaning samjho.

### Client

`Client` matlab jo request bhej raha hai.

Client ho sakta hai:

```text
Browser
Frontend app
curl command
Postman
Thunder Client
```

Example:

```bash
curl -X POST http://localhost/api/projects
```

Yaha `curl` client hai.

Example:

```text
http://abc.preview.localhost
```

Yaha browser client hai.

### HTTP Request

Jab client server ko kuch bolta hai, usko HTTP request bolte hain.

Request me usually ye hota hai:

```text
URL
method: GET / POST / PATCH / DELETE
headers
body
```

Example:

```bash
curl -X POST http://localhost/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Project"}'
```

Isme:

```text
method = POST
URL = /api/projects
header = Content-Type, Authorization
body = {"title":"Test Project"}
```

### localhost

`localhost` matlab tumhari local machine.

Browser me:

```text
http://localhost/api/auth/login
```

ka matlab hai request tumhare local Kubernetes ingress/controller setup pe ja rahi hai.

### nginx ingress

`nginx ingress` Kubernetes ke andar traffic router hai.

Browser ko ye nahi pata hota ki `/api/auth` kis service ko jaana hai ya `/api/projects` kis service ko jaana hai.

Ingress ka kaam:

```text
Request ka host/path dekho
  -> correct Kubernetes Service ko bhejo
```

Example:

```text
http://localhost/api/auth/login
  -> ingress dekhta hai path /api/auth
  -> auth-service ko bhejta hai
```

Example:

```text
http://localhost/api/projects
  -> ingress dekhta hai path /api/projects
  -> project-service ko bhejta hai
```

Example:

```text
http://abc.preview.localhost
  -> ingress dekhta hai host *.preview.localhost
  -> project-service ko bhejta hai
```

Short:

```text
nginx ingress = Kubernetes ka public traffic gate/router
```

### Kubernetes Service

Kubernetes Service ek stable internal address deta hai pods ke group ko.

Pod ka IP change ho sakta hai. Service ka name stable rehta hai.

Example:

```text
auth-service
project-service
nextjs-service-<runtimeId>
redis-service
```

`project-service` Service internally project pod tak traffic bhejti hai.

### Deployment

Deployment Kubernetes ko bolta hai:

```text
Mujhe itne replicas ke pods chalane hain,
is image se,
is env ke saath,
is health check ke saath.
```

Example:

```text
k8s/project-deployment.yml
  -> project-deployment
  -> project-service-image se pod banata hai
```

### Pod

Pod Kubernetes ka smallest deployable unit hai.

Simple case:

```text
1 pod = 1 container
```

Is project ke runtime preview me:

```text
1 pod = multiple containers
```

Example:

```text
nextjs-pod-<runtimeId>
  -> nextjs-container
  -> file-server-container
  -> sync-container
```

Ye teeno same pod me hain, isliye same shared volume `/app` use kar sakte hain.

### Container

Container Docker image ka running instance hota hai.

Example:

```text
image: nextboilerplate
  -> running container: nextjs-container
```

```text
image: express-file-server
  -> running container: file-server-container
```

### Docker Image

Docker image ek packaged application hoti hai.

Image me hota hai:

```text
code
dependencies
runtime command
```

Example:

```bash
docker build -t project-service-image -f project-service/dockerfile project-service
```

Isse `project-service-image` banti hai.

Kubernetes deployment us image se container chalata hai.

### Kubernetes API

Kubernetes API se code Kubernetes ko bol sakta hai:

```text
pod banao
service banao
pod delete karo
service delete karo
```

Is project me `project-service/src/service/kubernetes.service.ts` Kubernetes API use karta hai.

Example:

```ts
k8sApi.createNamespacedPod(...)
k8sApi.createNamespacedService(...)
```

### RBAC

RBAC permission system hai.

Project-service ko Kubernetes pod/service create/delete karna hai, isliye usko permission chahiye.

File:

```text
k8s/rbac.yml
```

Isme:

```text
ServiceAccount: resource-manager
ClusterRole: pods/services create/delete/list/watch
ClusterRoleBinding: service account ko role se bind karta hai
```

Then:

```text
k8s/project-deployment.yml
  -> serviceAccountName: resource-manager
```

Without RBAC, project-service Kubernetes resources create nahi kar paayega.

### Secret

Secret env values store karta hai jo code me hardcode nahi karni chahiye.

Example:

```text
MongoDB URI
JWT secret
Redis URL
AWS keys
Message broker URL
```

File:

```text
k8s/secrets.yml
```

Deployment me use:

```text
env:
  valueFrom:
    secretKeyRef:
```

### Endpoint

Endpoint batata hai Service ke peeche kaunsa ready pod IP hai.

Check:

```bash
kubectl get endpoints nextjs-service-<runtimeId>
```

If output:

```text
<none>
```

matlab service hai, but uske peeche ready pod nahi hai.

Preview proxy error me sabse pehle endpoints check karo.

### Port and targetPort

Kubernetes Service me:

```text
port = service ka port
targetPort = container ka port
```

Example:

```text
nextjs-service-<runtimeId>:80
  -> nextjs-container:3000
```

Yaha:

```text
port = 80
targetPort = 3000
```

### Volume / emptyDir

Volume shared storage hai.

Is project me runtime pod ke andar:

```text
app-volume: emptyDir
```

`emptyDir` ka matlab:

```text
Pod create hua to empty folder create hua.
Pod delete hua to folder delete.
Same pod ke containers is folder ko share kar sakte hain.
```

Yaha:

```text
nextjs-container mounts /app
file-server-container mounts /app
sync-container mounts /app
```

Isliye file-server jo file write karega, Next.js container usko same `/app` me dekh sakta hai.

### Runtime Pod

Runtime pod wo temporary pod hai jo user ke project launch pe banta hai.

Static deployments:

```text
auth-deployment
project-deployment
redis-deployment
```

Runtime pod:

```text
nextjs-pod-<runtimeId>
```

Ye har launched project ke liye dynamic banta hai.

### MongoDB

MongoDB persistent database hai.

Auth service user store karta hai.

Project service project metadata store karta hai:

```text
title
user
status
runtimeId
previewUrl
```

### Redis

Redis yaha preview idle tracking ke liye use ho raha hai.

Preview open hota hai:

```text
recordActivity(runtimeId)
  -> Redis key set hoti hai TTL ke saath
```

TTL expire:

```text
idle reaper pod/service delete karta hai
```

### Message Broker / RabbitMQ

Message broker services ke beech event pass karta hai.

Example:

```text
project-service project_created event publish karta hai
ai-service us event ko consume karta hai
```

### S3

S3 file backup/persistence ke liye planned hai.

`sync-service` `/app` folder ko S3 se sync karta hai.

If AWS keys fake hain, sync-container crash karega:

```text
InvalidAccessKeyId
```

## 1. Project Ko Ek Line Me Samjho

Ye project ek mini cloud IDE/live-preview system hai.

User login karta hai, project create karta hai, project launch karta hai. Launch ke time `project-service` Kubernetes me ek runtime pod banata hai. Us pod ke andar Next.js app, file server, aur optionally sync-service run hota hai.

Simple flow with meaning:

```text
Client (Browser / Frontend / curl / Postman)
  -> nginx ingress
  -> auth-service OR project-service
  -> project-service talks to Kubernetes API when project launch hota hai
  -> Kubernetes creates runtime pod
  -> runtime pod runs nextjs + file-server + sync
```

Har arrow ka meaning:

```text
Client
  Matlab request bhejne wali cheez. Browser, frontend, curl, Postman.

nginx ingress
  Public traffic router. Ye decide karta hai request auth-service ko jaye ya project-service ko.

auth-service
  Login/register/token ka kaam.

project-service
  Project create/launch ka kaam. Preview/file-system proxy ka kaam.

Kubernetes API
  Project-service is API ko call karke pod/service create karta hai.

runtime pod
  Ye user ke launched project ka actual running environment hai.
```

Example auth request:

```text
curl /api/auth/login
  -> nginx ingress
  -> auth-service
  -> login controller
  -> MongoDB user check
  -> token response
```

Example project create request:

```text
curl /api/projects
  -> nginx ingress
  -> project-service
  -> auth middleware
  -> createProjectController
  -> MongoDB project create
```

Example launch request:

```text
curl /api/projects/<projectId>/launch
  -> nginx ingress
  -> project-service
  -> launchProjectController
  -> launchProject service
  -> Kubernetes API
  -> nextjs-pod-<runtimeId> create
  -> nextjs-service-<runtimeId> create
```

Example preview request:

```text
browser <runtimeId>.preview.localhost
  -> nginx ingress
  -> project-service proxy
  -> nextjs-service-<runtimeId>:80
  -> nextjs-container:3000
```

Example file-system request:

```text
browser <runtimeId>.file-system.localhost/file-tree
  -> nginx ingress
  -> project-service proxy
  -> nextjs-service-<runtimeId>:8000
  -> file-server-container:8080
```

## 2. Senior Engineer Project Kaise Read Karega

Main unknown codebase me directly random controller nahi kholta. Order ye hota hai:

1. `rg --files` se files dekho.
2. Har service ka `package.json` dekho.
3. Har service ka `server.ts` dekho. Ye real entrypoint hota hai.
4. `app.ts` dekho. Yaha middleware and base routes milte hain.
5. `routes/*.ts` dekho. Yaha URL map hota hai.
6. `controller/*.ts` dekho. Yaha request validation and response hota hai.
7. `service/*.ts` dekho. Yaha real business logic hota hai.
8. `models/*.ts` dekho. DB schema samajh aata hai.
9. Dockerfile dekho. Image ka runtime command samajh aata hai.
10. `k8s/*.yml` dekho. Deployment/service/ingress/RBAC/secrets samajh aata hai.
11. Build/typecheck chalao.
12. Running cluster se compare karo: `kubectl get pods`, `svc`, `ingress`, `endpoints`.

Commands:

```bash
rg --files -g '!node_modules' -g '!dist' -g '!.next' -g '!tsconfig.tsbuildinfo'
find . -maxdepth 2 -type f \( -name 'package.json' -o -name 'dockerfile' -o -name 'Dockerfile' -o -name '*.yml' \) | sort
```

Cluster state:

```bash
kubectl get pods
kubectl get svc
kubectl get ingress
kubectl get endpoints
kubectl get deployments
```

## 3. Services Ka Kaam

| Folder | Role | Runs where |
| --- | --- | --- |
| `auth-service` | Login/register/token issue karta hai | Kubernetes deployment |
| `project-service` | Project create/launch, Kubernetes pod create, preview proxy | Kubernetes deployment |
| `express-file-server` | Runtime pod ke `/app` files read/write/delete karta hai | Runtime preview pod ke andar |
| `sync-service` | Runtime pod ke `/app` files S3 se sync karta hai | Runtime preview pod ke andar |
| `nextboilerplate` | New project ka starter Next.js app | Runtime preview pod ke andar |
| `ai-service` | LangChain assistant, file tools, SSE aur conversation history | Docker v2 pod ready; full AI request verification pending (Section 17) |
| `k8s` | Deployment/service/ingress/RBAC/secrets | Kubernetes manifests |

## 4. Ports Ka Map

| Component | Port | Meaning |
| --- | --- | --- |
| `auth-service` | `4000` | Auth API |
| `project-service` | `3000` | Project API and proxy |
| `nextjs-container` | `3000` | Live preview app |
| `file-server-container` | `8080` | File APIs |
| `sync-container` | no HTTP port | S3 sync worker |
| `redis` | `6379` | Idle preview tracking |
| `ai-service` | `3001` | AI API; Service port `80` -> targetPort `3001` |

Kubernetes runtime service mapping:

```text
nextjs-service-<runtimeId>:80
  -> nextjs-container:3000

nextjs-service-<runtimeId>:8000
  -> file-server-container:8080
```

## 5. Docker Image Rule

Jis folder ka code change hua, us folder ki image rebuild karo.

```text
auth-service change
  -> docker build auth-image
  -> kubectl rollout restart deployment/auth-deployment

project-service change
  -> docker build project-service-image
  -> kubectl rollout restart deployment/project-deployment

nextboilerplate change
  -> docker build nextboilerplate:latest
  -> old runtime pods change nahi honge
  -> new project launch karna padega

express-file-server change
  -> docker build express-file-server:latest
  -> old runtime pods change nahi honge
  -> new project launch karna padega

sync-service change
  -> docker build sync-service:latest
  -> old runtime pods change nahi honge
  -> new project launch karna padega

kubernetes.service.ts change
  -> ye project-service ke andar hai
  -> docker build project-service-image
  -> rollout restart project-deployment
  -> new launch ke time new pod manifest use hoga
```

Build commands:

```bash
cd ~/Desktop/journey/loveable

docker build -t auth-image -f auth-service/Dockerfile auth-service
docker build -t project-service-image -f project-service/dockerfile project-service
docker build -t nextboilerplate:latest -f nextboilerplate/dockerfile nextboilerplate
docker build -t express-file-server:latest -f express-file-server/dockerfile express-file-server
docker build -t sync-service:latest -f sync-service/dockerfile sync-service
```

Image me code gaya ya nahi check:

```bash
docker run --rm project-service-image sh -c "grep -n 'createPod' /app/src/service/kubernetes.service.ts"
docker run --rm sync-service:latest sh -c "test -f dist/server.js && echo ok"
```

Running pod me code gaya ya nahi check:

```bash
kubectl exec deployment/project-deployment -- sh -c "grep -n 'createPod' /app/src/service/kubernetes.service.ts"
```

## 6. Kubernetes Apply Flow

Fresh cluster me order important hai. Shared `k8s/ingress.yml` apply karne se pehle Section 17.9 ka AI-rule indentation blocker fix karo.

```bash
kubectl apply -f k8s/secrets.yml
kubectl apply -f k8s/redis.yml
kubectl apply -f k8s/rbac.yml
kubectl apply -f k8s/auth-deployment.yml
kubectl apply -f k8s/auth-service.yml
kubectl apply -f k8s/project-deployment.yml
kubectl apply -f k8s/project-service.yml
kubectl apply -f k8s/ingress.yml
```

Kya kya banta hai:

```text
k8s/secrets.yml
  -> database, auth, aws, redis, message-broker, ai secrets

k8s/redis.yml
  -> redis-deployment
  -> redis-service

k8s/rbac.yml
  -> resource-manager ServiceAccount
  -> ClusterRole
  -> ClusterRoleBinding

k8s/auth-deployment.yml
  -> auth-service pods

k8s/auth-service.yml
  -> auth-service ClusterIP service

k8s/project-deployment.yml
  -> project-service pod
  -> serviceAccountName: resource-manager

k8s/project-service.yml
  -> project-service ClusterIP service

k8s/ingress.yml
  -> nginx host/path routing
```

Check:

```bash
kubectl get pods
kubectl get svc
kubectl get ingress
kubectl get endpoints
```

## 7. Ingress Flow

File: `k8s/ingress.yml`

Ingress rules ka intended routing (AI rule ki YAML nesting abhi fix karni hai; Section 17.9):

```text
/api/auth
  -> auth-service:80
  -> auth pod:4000

/api/projects
  -> project-service:80
  -> project pod:3000

/api/ai
  -> ai-service:80
  -> AI pod:3001

*.preview.localhost
  -> project-service:80
  -> project pod:3000
  -> project-service proxy
  -> runtime nextjs service

*.file-system.localhost
  -> project-service:80
  -> project pod:3000
  -> project-service proxy
  -> runtime file-server service
```

Test ingress:

```bash
kubectl get ingress pineapple
kubectl describe ingress pineapple
```

If browser shows:

```text
404 Not Found nginx
```

Matlab nginx tak request aa gayi, but ingress rule match nahi hua.

## 8. Auth Flow: Login/Register Kaise Chalta Hai

Developer kya karega:

```bash
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Nayan","email":"nayan@test.com","password":"Password123"}'
```

Request ka internal flow:

```text
Browser/curl
  -> nginx ingress /api/auth
  -> auth-service Kubernetes Service
  -> auth-deployment pod
  -> auth-service/src/server.ts
  -> createApp()
  -> auth-service/src/app/app.ts
  -> app.use("/api/auth", createAuthRouter())
  -> auth-service/src/routes/auth.routes.ts
  -> router.post("/register", register)
  -> auth-service/src/controller/auth.controller.ts
  -> register()
```

`register()` function kya karta hai:

```text
validate name/email/password
  -> findUserByEmail()
  -> bcrypt.hash(password)
  -> createUser()
  -> sign accessToken
  -> sign refreshToken
  -> setRefreshTokenHash()
  -> response: user + accessToken + refreshToken
```

Important files:

```text
auth-service/src/server.ts
auth-service/src/app/app.ts
auth-service/src/routes/auth.routes.ts
auth-service/src/controller/auth.controller.ts
auth-service/src/DAO/user.dao.ts
auth-service/src/models/user.model.ts
auth-service/src/utils/token.util.ts
auth-service/src/config/env.ts
```

Login test:

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nayan@test.com","password":"Password123"}'
```

Token set:

```bash
TOKEN="paste-access-token-here"
```

Debug:

```bash
kubectl logs deployment/auth-deployment --tail=100
kubectl get endpoints auth-service
```

## 9. Project Create Flow

Developer kya karega:

```bash
curl -X POST http://localhost/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Project"}'
```

Request ka internal flow:

```text
curl
  -> nginx ingress /api/projects
  -> project-service Kubernetes Service
  -> project-deployment pod
  -> project-service/src/server.ts
  -> project-service/src/app/app.ts
  -> app.use(express.json())
  -> app.use("/api/projects", router)
  -> project-service/src/app/index.route.ts
  -> project-service/src/routes/project.routes.ts
  -> projectRouter.use(authenticate)
  -> createProjectController()
```

`authenticate()` function kya karta hai:

File: `project-service/src/middleware/auth.middleware.ts`

```text
Authorization header read karta hai
  -> Bearer token extract karta hai
  -> jwt.verify(token, ACCESS_TOKEN_SECRET)
  -> req.user = { id, email, name }
  -> next()
```

`createProjectController()` kya karta hai:

File: `project-service/src/controller/project.controller.ts`

```text
req.body.title read karta hai
  -> title empty/too long hai to 400 error
  -> createProject(req.user.id, title)
  -> publishMessage("project_created", { projectId, userId })
  -> response 201 with project
```

`createProject()` kya karta hai:

File: `project-service/src/service/project.service.ts`

```text
Project.create({ user: userId, title })
```

Mongo model:

File: `project-service/src/models/project.model.ts`

```text
user
title
status: created | launching | running | failed
runtimeId
previewUrl
timestamps
```

Message broker effect:

File: `project-service/src/service/broker.service.ts`

```text
project_created queue me message publish hota hai
ai-service future me isko consume karke AI context create karega
```

Expected response:

```json
{
  "project": {
    "_id": "...",
    "user": "...",
    "title": "Test Project",
    "status": "created"
  }
}
```

Debug:

```bash
kubectl logs deployment/project-deployment --tail=100
kubectl exec deployment/project-deployment -- sh -c "grep -n 'express.json' /app/src/app/app.ts"
```

Common error:

```text
Expected Authorization: Bearer <token>
```

Meaning: token header missing.

Common error:

```text
Invalid or expired access token
```

Meaning: token expired/fake/wrong secret.

Common error:

```text
Title must contain between 1 and 120 characters
```

Meaning: body parse issue or title invalid. First check `express.json()`.

## 10. Project Launch Flow

Developer kya karega:

```bash
PROJECT_ID="paste-project-id"

curl -X POST http://localhost/api/projects/$PROJECT_ID/launch \
  -H "Authorization: Bearer $TOKEN"
```

Request ka internal flow:

```text
curl
  -> nginx ingress /api/projects/:id/launch
  -> project-service
  -> authenticate()
  -> launchProjectController()
  -> launchProject(projectId, userId)
```

`launchProjectController()` kya karta hai:

File: `project-service/src/controller/project.controller.ts`

```text
projectId params se leta hai
  -> launchProject(projectId, req.user.id)
  -> response: Project launched successfully
```

`launchProject()` kya karta hai:

File: `project-service/src/service/project.service.ts`

```text
isValidObjectId(projectId)
  -> Project.findOneAndUpdate({
       _id: projectId,
       user: userId,
       status: created/failed
     }, status = launching)
  -> runtimeId = project._id.toString()
  -> podName = nextjs-pod-<runtimeId>
  -> serviceName = nextjs-service-<runtimeId>
  -> createPod(podName, project.id)
  -> createService(serviceName, podName)
  -> recordActivity(runtimeId)
  -> project.status = running
  -> project.runtimeId = runtimeId
  -> project.previewUrl = http://<runtimeId>.preview.localhost
  -> save project
```

If kuch fail hua:

```text
deleteService(serviceName)
deletePod(podName)
project.status = failed
throw error
```

## 11. Launch Ke Time Kubernetes Me Kya Hota Hai

Main file:

```text
project-service/src/service/kubernetes.service.ts
```

`createPod(podName, projectId)` Kubernetes API se pod banata hai.

Pod name:

```text
nextjs-pod-<runtimeId>
```

Pod label:

```text
app: nextjs-pod-<runtimeId>
```

Pod volume:

```text
app-volume: emptyDir
```

`emptyDir` ka meaning:

```text
Pod ke lifetime tak ek shared folder.
Same pod ke multiple containers is volume ko mount kar sakte hain.
```

Init container:

```text
name: init-container
image: nextboilerplate:latest
mount: app-volume at /app-copy
command: cp -r /app/* /app-copy
```

Init container ka kaam:

```text
nextboilerplate image ke andar jo default Next.js project hai,
usko shared volume me copy karna.
```

Normal containers:

```text
nextjs-container
  image: nextboilerplate
  port: 3000
  mount: app-volume at /app

file-server-container
  image: express-file-server
  port: 8080
  mount: app-volume at /app

sync-container
  image: sync-service
  no HTTP port
  mount: app-volume at /app
  env: PROJECT_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

Why all mount `/app`?

```text
Next.js container code run karta hai from /app.
File-server same /app files read/write karta hai.
Sync-service same /app files S3 se sync karta hai.
```

`createService(serviceName, podName)` kya karta hai:

```text
Service name: nextjs-service-<runtimeId>
selector: app = nextjs-pod-<runtimeId>

port 80   -> targetPort 3000
port 8000 -> targetPort 8080
```

Matlab:

```text
http://nextjs-service-<runtimeId>
  -> nextjs-container:3000

http://nextjs-service-<runtimeId>:8000
  -> file-server-container:8080
```

Test:

```bash
ID=<runtimeId>

kubectl get pod nextjs-pod-$ID
kubectl get svc nextjs-service-$ID
kubectl get endpoints nextjs-service-$ID
kubectl describe pod nextjs-pod-$ID
```

Expected:

```text
3/3 Running
```

If S3 sync disabled/removed:

```text
2/2 Running
```

If sync AWS keys fake:

```text
2/3 CrashLoopBackOff
```

## 12. Preview URL Flow

Developer/browser kya karega:

```text
http://<runtimeId>.preview.localhost
```

Full request flow:

```text
Browser
  -> nginx ingress host *.preview.localhost
  -> project-service service port 80
  -> project-service pod port 3000
  -> project-service/src/app/app.ts
  -> middleware host read karta hai
  -> uniqueId = host.split(".")[0]
  -> getProxy(uniqueId)
  -> target = http://nextjs-service-<uniqueId>
  -> Kubernetes service port 80
  -> nextjs-container port 3000
  -> Next.js app response
```

Function:

File: `project-service/src/app/app.ts`

```text
getProxy(uniqueId)
  -> proxyMap cache check karta hai
  -> createProxyMiddleware({ target: http://nextjs-service-<uniqueId> })
  -> request forward karta hai
```

Test:

```bash
curl -I http://<runtimeId>.preview.localhost
kubectl logs deployment/project-deployment --tail=100
kubectl get endpoints nextjs-service-<runtimeId>
```

If browser says:

```text
Error occurred while trying to proxy
```

Then:

```text
project-service reached
but nextjs-service-<runtimeId> unreachable
```

Debug:

```bash
kubectl get pod nextjs-pod-$ID
kubectl get svc nextjs-service-$ID
kubectl get endpoints nextjs-service-$ID
kubectl describe pod nextjs-pod-$ID
```

If endpoint `<none>` hai, browser debug mat karo. Pehle pod ready karo.

## 13. File-System URL Flow

Correct URL:

```text
http://<runtimeId>.file-system.localhost/file-tree
```

Wrong URL:

```text
http://file-system.localhost/file-tree
```

Why wrong?

`project-service` runtime ID first subdomain se nikalta hai:

```text
<runtimeId>.file-system.localhost
```

Full request flow:

```text
Browser/curl
  -> nginx ingress host *.file-system.localhost
  -> project-service service port 80
  -> project-service pod port 3000
  -> project-service/src/app/app.ts
  -> host includes "file-system"
  -> getProxyForFiles(uniqueId)
  -> target = http://nextjs-service-<uniqueId>:8000
  -> Kubernetes service port 8000
  -> file-server-container port 8080
  -> express-file-server route
```

Function:

File: `project-service/src/app/app.ts`

```text
getProxyForFiles(uniqueId)
  -> target = http://nextjs-service-<uniqueId>:8000
  -> request file-server-container tak forward
```

File-server routes:

File: `express-file-server/src/routes/file.routes.ts`

```text
GET    /file-tree
GET    /files
POST   /files
PATCH  /files
DELETE /files
```

`getFileTree()` ka flow:

```text
GET /file-tree
  -> getFileTree controller
  -> fileService.getFileTree()
  -> recursive walk /app
  -> ignored dirs/files skip
  -> JSON response with tree
```

`readFiles()` ka flow:

```text
GET /files?filenames=/app/page.tsx,/package.json
  -> parseFilenamesQuery()
  -> toAbsolutePath()
  -> fs.readFile()
  -> response files object
```

`writeFiles()` ka flow:

```text
POST/PATCH /files
  -> body is { "/path": "content" }
  -> toAbsolutePath()
  -> mkdir parent folders
  -> fs.writeFile()
```

`deleteFiles()` ka flow:

```text
DELETE /files?filenames=/path
  -> toAbsolutePath()
  -> fs.rm()
```

Security:

File: `express-file-server/src/utils/path.util.ts`

```text
toAbsolutePath()
  -> requested path ko /app ke andar resolve karta hai
  -> ../../etc/passwd type path reject karta hai
```

Tests:

```bash
ID=<runtimeId>

curl http://$ID.file-system.localhost/file-tree

curl "http://$ID.file-system.localhost/files?filenames=/app/page.tsx"

curl -X PATCH http://$ID.file-system.localhost/files \
  -H "Content-Type: application/json" \
  -d '{"/README_TEST.md":"hello from file server"}'

curl "http://$ID.file-system.localhost/files?filenames=/README_TEST.md"
```

Logs:

```bash
kubectl logs nextjs-pod-$ID -c file-server-container --tail=100
```

## 14. Sync Service Flow

Sync-service HTTP API nahi hai. Ye worker hai.

File:

```text
sync-service/src/server.ts
```

Startup:

```text
main()
  -> read env from sync-service/src/config/env.ts
  -> bootstrap()
  -> startWatcher()
```

Required env:

```text
PROJECT_ID
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

Optional env:

```text
S3_BUCKET default pienapple
AWS_REGION default ap-southeast-1
WORK_FOLDER default /app
```

`bootstrap()` kya karta hai:

File: `sync-service/src/service/sync.service.ts`

```text
listRemoteFiles()
  -> S3 me projects/<PROJECT_ID>/ prefix ke under files dekhta hai

if remote files exist:
  -> downloadFile() each file
  -> S3 se /app me restore

else:
  -> listLocalFiles()
  -> /app ke boilerplate files scan
  -> uploadFile() each file
  -> first version S3 me push
```

`startWatcher()` kya karta hai:

File: `sync-service/src/service/watcher.service.ts`

```text
chokidar.watch(WORK_FOLDER)
  -> add/change event queue hota hai
  -> delete event queue hota hai
  -> debounce ke baad S3 flush
```

`s3.service.ts` functions:

```text
listRemoteFiles()
  -> ListObjectsV2Command

uploadFile()
  -> PutObjectCommand

downloadFile()
  -> GetObjectCommand

deleteFiles()
  -> DeleteObjectsCommand
```

Test sync container:

```bash
ID=<runtimeId>

kubectl logs nextjs-pod-$ID -c sync-container --tail=100
kubectl logs nextjs-pod-$ID -c sync-container --previous
```

If logs show:

```text
InvalidAccessKeyId
```

Meaning:

```text
k8s/secrets.yml me AWS keys placeholder/fake hain.
Code issue nahi hai.
```

If abhi S3 nahi karna:

```text
sync-container ko runtime pod se temporarily hatao
project-service image rebuild karo
project-deployment restart karo
new project launch karo
expected: 2/2 Running
```

## 15. Idle Cleanup Flow

File:

```text
project-service/src/service/activity.service.ts
```

Kaam:

```text
Preview inactive ho to pod/service delete karna.
```

Flow:

```text
Preview/file-system request aayi
  -> app.ts me recordActivity(uniqueId)
  -> Redis key set: preview:active:<uniqueId>
  -> key TTL default 2 minutes

TTL expire hua
  -> Redis key expiry event
  -> reap(uniqueId)
  -> deleteService(nextjs-service-<uniqueId>)
  -> deletePod(nextjs-pod-<uniqueId>)
  -> Project status back to created
  -> runtimeId and previewUrl unset
```

Why old preview URL fail hota hai?

```text
Idle reaper ne pod/service delete kar diya ho sakta hai.
DB stale ho sakta hai.
Service bachi ho aur pod deleted ho sakta hai.
```

Debug:

```bash
kubectl get pod nextjs-pod-$ID
kubectl get svc nextjs-service-$ID
kubectl get endpoints nextjs-service-$ID
kubectl logs deployment/project-deployment --tail=100
```

If service exists but pod missing:

```bash
kubectl delete svc nextjs-service-$ID --ignore-not-found
```

If service delete stuck:

```bash
kubectl patch service nextjs-service-$ID \
  --type=merge \
  -p '{"metadata":{"finalizers":[]}}'

kubectl delete service nextjs-service-$ID --wait=false
```

## 16. Message Broker Flow

Project create ke baad:

```text
project-service/src/controller/project.controller.ts
  -> publishMessage("project_created", JSON.stringify({ projectId, userId }))
```

Broker file:

```text
project-service/src/service/broker.service.ts
```

AI-service consumer:

```text
ai-service/src/service/broker.service.ts
  -> setupConsumers()
  -> consume project_created
  -> ProjectModel.create({ projectId, userId, context: "" })
```

Meaning:

```text
Project create hone par AI-service ko pata chalna chahiye ki naya project aaya.
AI-service uska AI context create karega.
```

Debug:

```bash
kubectl logs deployment/project-deployment --tail=100
kubectl logs deployment/ai-deployment --tail=100
```

Current limitation:

Consumer wired hai, lekin `consumeMessage()` async callback ko await kiye bina message ack karta hai. Database save fail ho to event already acknowledged ho sakta hai. Consumer persistence aur retry/idempotency ko live test aur harden karna baaki hai; AI Project record missing ho to message request `Project not found` return karegi.

## 17. AI Service: LangChain, Messages aur Streaming

AI message handling ab implemented hai: controller authenticated project request leta hai, MongoDB history load karta hai, LangChain agent chalata hai, SSE response bhejta hai aur naye AI/tool messages save karta hai. TypeScript aur focused mocked-stream checks pass hue hain. Docker image `ai-service-image:v2` ka pod ready hua, MongoDB/RabbitMQ connection logs aur health-check HTTP 200 verify hue. Live Mistral + frontend + file-tool conversation flow abhi verify karna baaki hai.

### 17.1 Kaunsi file kya karti hai?

| File | Responsibility |
| --- | --- |
| `ai-service/src/server.ts` | Broker/database connect, consumers setup, port `3001` par listen |
| `ai-service/src/app/app.ts` | JSON parsing, `/api/ai` router aur health endpoints |
| `ai-service/src/app/index.routes.ts` | Authentication middleware ke baad AI routes mount |
| `ai-service/src/routes/ai.routes.ts` | `POST /message` ko controller se connect |
| `ai-service/src/controller/ai.controller.ts` | Ownership checks, conversation/history, SSE aur persistence |
| `ai-service/src/service/ai/ai.service.ts` | Conversation title generation aur agent stream start |
| `ai-service/src/service/ai/fs.agent.ts` | Mistral model, file tools aur system instructions se `mainAgent` create |
| `ai-service/src/service/ai/fs.instruction.ts` | Read-before-edit, complete-file updates aur reply rules |
| `ai-service/src/service/ai/fs.tool.ts` | Runtime file-server ke liye Axios-backed tools |
| `ai-service/src/config/env.ts` | Required environment variables aur tracing default |
| `ai-service/src/models/message.model.ts` | User/AI/tool messages, tool calls aur results ka storage |

### 17.2 Request contract

```http
POST /api/ai/message
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "projectId": "project-service-se-mila-project-id",
  "content": "Homepage ka heading update karo"
}
```

Existing chat continue karna ho to `conversationId` bhi bhejo. New conversation ke first request mein is field ko omit karo.

`projectId` original project-service project ka ID hai. AI-service apni local Project collection mein `{ projectId, userId }` se ownership check karti hai; local Project record ka `_id` aur original `projectId` ko interchangeable mat samjho.

### 17.3 Request se response tak complete flow

```text
POST /api/ai/message
  -> Bearer token verify -> req.user
  -> ProjectModel.findOne({ projectId, userId })
  -> existing conversation? project/user ownership check
  -> new conversation? mistral-small-latest se structured title
  -> X-Conversation-Id / X-Conversation-Title response headers
  -> user message MongoDB mein save
  -> history load: createdAt ASC, _id ASC
  -> user / ai / tool records ko LangChain message objects mein map
  -> mainAgent.stream(history, configurable.podId = original projectId)
       -> mistral-large-latest + file tools + mainAgentInstruction
       -> messages mode: token -> JSON-encoded SSE -> client
       -> values mode: state snapshot -> naye AI/tool messages -> MongoDB
  -> stream complete -> res.end()
```

Model names upar current code ke configured names hain. Agent stream mein `timeout: 600000` pass hota hai. Ye frontend disconnect handling ya har Axios tool request ke liye explicitly configured timeout ka substitute nahi hai.

### 17.4 File tools kaise project tak pahunchte hain?

```text
Agent ko tool call karna hai
  -> ToolRuntime.configurable.podId
  -> http://nextjs-service-<projectId>:8000
  -> Kubernetes service port 8000
  -> file-server-container targetPort 8080
  -> runtime project ke files
```

| Tool | HTTP call | Kaam |
| --- | --- | --- |
| `get_file_tree` | `GET /file-tree` | Files discover karna |
| `get_files` | `GET /files?filenames=...` | Existing file contents read karna |
| `create_files` | `POST /files` | New files create karna |
| `update_files` | `PATCH /files` | Complete file content replace karna |
| `remove_files` | `DELETE /files?filenames=...` | Files/directories remove karna |

Instructions agent ko pehle files read karne, project conventions follow karne aur tool success ke baad hi success claim karne ko kehti hain. Instructions model guidance hain; server-side access control aur file validation ka replacement nahi.

Project ka runtime launch aur file-server ready hona chahiye. AI-service ke local Project record ka hona runtime service running hone ki guarantee nahi hai. Laptop se direct process run karne par cluster-internal service DNS usually available nahi hota; full file-tool flow ke liye cluster networking bhi chahiye.

### 17.5 SSE response aur frontend handling

Response headers:

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Conversation-Id: <conversation-id>
X-Conversation-Title: <generated-title>
```

Har token event mein JSON payload hai:

```text
data: {"text":"Hello\nnext line"}

```

Controller exact frame `data: ${JSON.stringify({ text: token.text })}\n\n` bhejta hai. JSON encoding newline ko escape karti hai, isliye multiline text event boundaries ko break nahi karta.

Frontend ke SSE parser ko complete event milne ke baad:

```ts
const payload = JSON.parse(eventData);
appendText(payload.text);
```

Ye parser callback ka fragment hai, full client nahi. `eventData` sirf SSE `data:` ka content hai. Raw network chunks ko direct `JSON.parse` mat karo: ek event multiple chunks mein split ho sakta hai, ya ek chunk mein multiple events aa sakte hain. Streaming decoder aur SSE frame buffering use karo.

Endpoint `POST` + Bearer header use karta hai, isliye request body/headers support karne wala streaming client, jaise `fetch` with a stream parser, chahiye. Response headers se conversation ID store karke next turn mein bhejo. Current implementation completion par connection end karti hai; explicit `done`/`error` SSE events abhi implemented nahi hain.

### 17.6 History save karne wale fixes

- Loaded history ko stable IDs milte hain; per-request saved-ID set existing records se seed hota hai.
- `values` snapshot ke sabhi messages inspect hote hain, sirf last message nahi.
- Multiple tools ek step mein results dein to har result uske `toolCallId` ke saath save hota hai.
- Repeated snapshots same message ko dobara insert nahi karti; saved mark successful write ke baad hota hai.
- Full `AIMessage` aur `AIMessageChunk` dono handle hote hain.
- Structured tool content JSON serialize hota hai, `[object Object]` mein convert nahi hota.

ID-less output ke liye state index fallback hai, jo current append-only history assumption par depend karta hai. Deduplication ek request ke snapshots ke liye hai; concurrent requests, interrupted turns aur client retries ke liye durable idempotency/coordination abhi nahi hai.

### 17.7 Environment setup

`ai-service` local process `dotenv.config()` se `.env` load karta hai. Required values missing/blank ho to import/startup fail hota hai.

| Variable | Current behavior / purpose |
| --- | --- |
| `MONGODB_URI` | Required; AI-service database |
| `ACCESS_TOKEN_SECRET` | Required; auth-service ke compatible signing secret se JWT verification |
| `MESSAGE_BROKER_URL` | Required; project-created events ke liye RabbitMQ |
| `MISTRAL_API_KEY` | Required; title aur main model requests |
| `LANGSMITH_TRACING` | Unset ho to code `true` set karta hai; local tracing off karni ho to `false` |
| `LANGSMITH_ENDPOINT` | LangSmith endpoint configuration |
| `LANGSMITH_API_KEY` | Tracing credentials |
| `LANGSMITH_PROJECT` | Traces group karne ka project name |
| `PORT` | Config parse karta hai, lekin current `server.ts` hardcoded `3001` par listen karta hai |

Local `.env` ki values apne environment se set karo; real credentials Git mein commit mat karo. Variable names ke template ke liye `k8s/secrets.example.yml` dekho. Local `MONGODB_URI` Kubernetes ke `database` secret ki `AI_DB` key se inject hota hai.

Kubernetes deployment `ai` secret se Mistral key aur chaar LangSmith settings inject karta hai. Ye secret references currently non-optional hain: tracing disabled ho tab bhi referenced keys exist karni chahiye, warna pod container configuration error de sakta hai.

### 17.8 Run aur verify

Project root se:

```bash
cd ai-service
npm ci
npm exec tsc -- --noEmit
```

`.env`, reachable MongoDB aur RabbitMQ configure karne ke baad:

```bash
npm exec tsx -- src/server.ts
```

Dusre terminal se:

```bash
curl -i http://localhost:3001/_status/healthz
```

`TOKEN` aur `PROJECT_ID` ko apne valid access token aur owned, launched project ID se set karo:

```bash
TOKEN="paste-access-token"
PROJECT_ID="paste-project-id"
curl -N -i -X POST http://localhost:3001/api/ai/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"content\":\"Project ka file tree check karke structure batao\"}"
```

`-N` curl output buffering disable karta hai. Ye request real model/tool calls karegi. Local server se file tools test karne ke liye runtime DNS/network connectivity pehle arrange karo; sirf AI-service ko port-forward karna us process ki file-server connectivity fix nahi karta.

Next message mein response se mila conversation ID use karo:

```bash
CONVERSATION_ID="paste-conversation-id"
curl -N -i -X POST http://localhost:3001/api/ai/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"conversationId\":\"$CONVERSATION_ID\",\"content\":\"Pichhli request ka short summary do\"}"
```

Verify: response text render hota hai, conversation ID reuse hota hai, tool-call/result pairs complete hain aur old history duplicate nahi hoti. Typecheck/model-free checks ye live behavior prove nahi karte. `npm test` abhi placeholder script hai; focused mocked checks permanent npm test suite ka hissa nahi hain.

### 17.9 Kubernetes wiring aur remaining blockers

Configured mapping:

```text
/api/ai -> ai-service:80 -> AI pod:3001
AI file tool -> nextjs-service-<projectId>:8000 -> file-server:8080
```

`k8s/ai-service.yml` ka targetPort ab `3001` hai. Deployment model/tracing variables inject karta hai. Ingress mein read/send timeouts `600` configured hain, lekin current AI rule ki YAML nesting sahi nahi: `paths` ko `http` ke andar hona chahiye, sibling nahi.

Correct rule shape, existing `spec.rules` list ke andar:

```yaml
    - http:
        paths:
          - pathType: Prefix
            path: /api/ai
            backend:
              service:
                name: ai-service
                port:
                  number: 80
```

**Build status aur pending work:**

- Dockerfile ab dependencies install karke `npm run build` chalata hai aur `node dist/server.js` start karta hai. TypeScript mein `rootDir: ./src` aur `outDir: ./dist` configured hain; missing `dist/server.js` startup error resolve hua. `npm start` script abhi nahi hai; Docker direct Node command use karta hai.
- Ingress file ka AI rule upar wale nesting pattern se fix karna hai. Shared ingress apply tabhi karo; invalid rule doosre routes ki update bhi block kar sakta hai.
- Request body/ObjectId validation, stream error/completion events aur client-disconnect cancellation add karni hai.
- `error.middleware.ts` present hai, lekin app mein mounted nahi; uniform error handling abhi pending hai.
- Actual streaming latency, ingress buffering, live file edits aur follow-up conversation end-to-end test karne hain.

Ye README current code describe karti hai; upar ke suggested deployment corrections implementation mein automatically apply nahi hue hain.

## 18. Full Fresh Setup Test Flow

Neeche core auth/project/runtime setup hai. Shared ingress apply se pehle Section 17.9 ka indentation fix chahiye; AI image `v2` build aur pod readiness verify ho chuki hai. AI-service ka local verification flow Section 17.8 mein hai.

Step 1: images build karo

```bash
cd ~/Desktop/journey/loveable

docker build -t auth-image -f auth-service/Dockerfile auth-service
docker build -t project-service-image -f project-service/dockerfile project-service
docker build -t nextboilerplate:latest -f nextboilerplate/dockerfile nextboilerplate
docker build -t express-file-server:latest -f express-file-server/dockerfile express-file-server
docker build -t sync-service:latest -f sync-service/dockerfile sync-service
```

Step 2: manifests apply karo

```bash
kubectl apply -f k8s/secrets.yml
kubectl apply -f k8s/redis.yml
kubectl apply -f k8s/rbac.yml
kubectl apply -f k8s/auth-deployment.yml
kubectl apply -f k8s/auth-service.yml
kubectl apply -f k8s/project-deployment.yml
kubectl apply -f k8s/project-service.yml
kubectl apply -f k8s/ingress.yml
```

Step 3: cluster check

```bash
kubectl get pods
kubectl get svc
kubectl get ingress
kubectl get endpoints
```

Step 4: login/register

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nayan@test.com","password":"Password123"}'
```

Step 5: token set

```bash
TOKEN="paste-access-token"
```

Step 6: create project

```bash
curl -X POST http://localhost/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Project"}'
```

Step 7: launch project

```bash
PROJECT_ID="paste-project-id"

curl -X POST http://localhost/api/projects/$PROJECT_ID/launch \
  -H "Authorization: Bearer $TOKEN"
```

Step 8: runtime resources check

```bash
ID=<runtimeId>

kubectl get pod nextjs-pod-$ID
kubectl get svc nextjs-service-$ID
kubectl get endpoints nextjs-service-$ID
kubectl describe pod nextjs-pod-$ID
```

Step 9: preview test

```bash
curl -I http://$ID.preview.localhost
```

Browser:

```text
http://<runtimeId>.preview.localhost
```

Step 10: file-system test

```bash
curl http://$ID.file-system.localhost/file-tree
curl "http://$ID.file-system.localhost/files?filenames=/app/page.tsx"
```

Step 11: logs

```bash
kubectl logs deployment/project-deployment --tail=100
kubectl logs nextjs-pod-$ID -c nextjs-container --tail=100
kubectl logs nextjs-pod-$ID -c file-server-container --tail=100
kubectl logs nextjs-pod-$ID -c sync-container --tail=100
```

AI image build/update karne ke liye project root se:

```bash
docker build -t ai-service-image:v2 -f ai-service/dockerfile ai-service
```

Image cluster nodes ko available honi chahiye. Agle code update par naya tag build karke deployment ka image tag bhi update karo, taaki cached image reuse na ho.

AI deployment/service apply karo; ingress command se pehle Section 17.9 ka YAML nesting fix chahiye:

```bash
kubectl apply -f k8s/ai-deployment.yml
kubectl apply -f k8s/ai-service.yml
kubectl apply -f k8s/ingress.yml
kubectl rollout status deployment/ai-deployment
kubectl logs deployment/ai-deployment --tail=100
```

Deployment `ai-service-image:v2` aur `imagePullPolicy: IfNotPresent` use karta hai. Exact image node par cached ho sakti hai; nahi ho to reachable registry se pull honi chahiye. Registry use karo to deployment mein matching qualified image name set karo. Ingress healthy hone ke baad Section 17.8 ke curl examples mein base URL `http://localhost:3001` ki jagah `http://localhost` use karo.

## 19. Error Debug Map

### `nginx 404`

Meaning:

```text
nginx reached but ingress rule match nahi hua.
```

Check:

```bash
kubectl get ingress
kubectl describe ingress pineapple
```

### `Expected Authorization: Bearer <token>`

Meaning:

```text
Project-service reached, but Authorization header missing.
```

Fix:

```bash
TOKEN="fresh-token"
```

Use:

```bash
-H "Authorization: Bearer $TOKEN"
```

### `Invalid or expired access token`

Meaning:

```text
Token expired/fake/wrong secret.
```

Fix:

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nayan@test.com","password":"Password123"}'
```

### `Project not found`

Meaning:

```text
PROJECT_ID placeholder use kiya, invalid ObjectId diya, ya project tumhare user ka nahi.
```

Fix:

```text
Create project response se real _id copy karo.
```

### `Title must contain between 1 and 120 characters`

Meaning:

```text
Title missing hai ya JSON body parse nahi hui.
```

Check:

```bash
kubectl exec deployment/project-deployment -- sh -c "grep -n 'express.json' /app/src/app/app.ts"
```

### Preview proxy error

Meaning:

```text
project-service target nextjs-service tak nahi pahunch pa raha.
```

Check:

```bash
kubectl get endpoints nextjs-service-$ID
kubectl describe pod nextjs-pod-$ID
```

### Endpoint `<none>`

Meaning:

```text
Service hai, but ready pod nahi hai.
```

Check:

```bash
kubectl get pods
kubectl describe pod nextjs-pod-$ID
```

### `2/3 CrashLoopBackOff`

Meaning:

```text
3 containers me se ek crash kar raha hai. Mostly sync-container.
```

Check:

```bash
kubectl logs nextjs-pod-$ID -c sync-container --previous
```

### `InvalidAccessKeyId`

Meaning:

```text
AWS key fake/placeholder hai. S3 setup issue, app code issue nahi.
```

### Docker image old code chala raha hai

Check image:

```bash
docker run --rm project-service-image sh -c "grep -n 'express.json' /app/src/app/app.ts"
```

Check running pod:

```bash
kubectl exec deployment/project-deployment -- sh -c "grep -n 'express.json' /app/src/app/app.ts"
```

Fix:

```bash
docker build -t project-service-image -f project-service/dockerfile project-service
kubectl rollout restart deployment/project-deployment
kubectl rollout status deployment/project-deployment
```

## 20. Production Mindset: Kaha Rukna Chahiye

Random code edit tab tak mat karo jab tak ye clear na ho:

1. Request correct URL pe ja rahi hai?
2. HTTP method correct hai?
3. Header/token present hai?
4. Ingress route match ho raha hai?
5. Service exist karta hai?
6. Endpoint empty to nahi?
7. Pod ready hai?
8. Kaunsa container fail ho raha hai?
9. Logs kya bol rahe hain?
10. Docker image me latest code hai?
11. Running pod me latest code hai?

Senior engineer ka rule:

```text
Pehle observe karo, fir prove karo, fir fix karo.
Guess karke code mat badlo.
```

## 21. One Complete Mental Movie

Imagine tumne `POST /api/projects` call kiya:

```text
curl
  -> nginx
  -> project-service Kubernetes Service
  -> project-service pod
  -> app.ts
  -> routes
  -> authenticate
  -> controller
  -> service
  -> MongoDB Project.create
  -> RabbitMQ project_created message
  -> response project created
```

Then tumne launch call kiya:

```text
curl
  -> nginx
  -> project-service
  -> launchProjectController
  -> launchProject
  -> Kubernetes client
  -> create pod nextjs-pod-<id>
  -> create service nextjs-service-<id>
  -> Redis recordActivity
  -> MongoDB status running
  -> response previewUrl
```

Then browser preview open kiya:

```text
browser <id>.preview.localhost
  -> nginx wildcard host
  -> project-service
  -> getProxy(id)
  -> nextjs-service-<id>:80
  -> nextjs-container:3000
  -> Next.js HTML
```

Then file-tree open kiya:

```text
browser <id>.file-system.localhost/file-tree
  -> nginx wildcard host
  -> project-service
  -> getProxyForFiles(id)
  -> nextjs-service-<id>:8000
  -> file-server-container:8080
  -> getFileTree()
  -> recursive /app walk
  -> JSON tree
```

Then file edit hua:

```text
PATCH /files
  -> file-server-container writes /app file
  -> same /app volume nextjs-container sees update
  -> sync-container watcher sees change
  -> uploads to S3 if credentials valid
```

Then AI ko change request bheji:

```text
POST /api/ai/message + Bearer token
  -> owned project / conversation checks
  -> MongoDB history -> LangChain mainAgent
  -> get_file_tree / get_files -> update_files
  -> runtime file-server writes complete file
  -> JSON SSE tokens -> frontend
  -> new AI + all tool results persisted without snapshot duplicates
```

Ye AI code path implemented hai; deployment blockers aur live verification status Section 17 mein diye hain.

Ye project ka core flow hai.
