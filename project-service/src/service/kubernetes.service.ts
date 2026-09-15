import * as k8s from "@kubernetes/client-node"
import { response } from "express";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);


export async function createPod(podName: string, projectId: string) {

    const podManifest = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
            name: podName,
            labels: {
                app: podName
            }
        },
        spec: {
            volumes : [
                {
                    name : 'app-volume',
                    emptyDir : {} //Kubernetes pod ke andar temporary shared storage , Important: emptyDir pod-level volume hai, container-level nahi. so both containers Next.js container & file-server container both see same files.
                }
            ],
            initContainers : [
                 {
                    name: 'init-container', //Init container runs before normal application containers.
                    image: "525390917683.dkr.ecr.ap-south-1.amazonaws.com/nextjs-boilerplate",
                    command: ['sh', '-c', 'mkdir -p /app-copy && cp -r /app/* /app-copy'],
                    volumeMounts: [ //initContainer mein bhi volumeMounts kyu hai? --> Init container ko bhi shared app-volume mein files copy karni hain. Isliye usko bhi volume mount karna padega.
                        {
                            name: 'app-volume', 
                            mountPath: '/app-copy'
                        }
                    ]
                }
            ],
            containers: [
                {
                    name: 'nextjs-container',
                    image: '525390917683.dkr.ecr.ap-south-1.amazonaws.com/nextjs-boilerplate',
                    ports: [
                        {
                            containerPort: 3000
                        }
                    ],
                    resources: {
                        requests: {
                            memory: '1024Mi',   // Minimum memory guaranteed
                            cpu: '500m'       // Minimum CPU guaranteed (0.5 cores)
                        },
                        limits: {
                            memory: '2048Mi',  // Maximum memory allowed before OOMKilled
                            cpu: '1000m'       // Maximum CPU allowed before throttling
                        }
                    },
                     volumeMounts: [
                        {
                            name: 'app-volume', //1st volume mount Next.js container ke andar hai.
                            mountPath: '/app'
                        }
                    ]
                },
                {
                    name: 'file-server-container',
                    image: '525390917683.dkr.ecr.ap-south-1.amazonaws.com/express-file-server',
                    ports: [
                        {
                            containerPort: 8080
                        }
                    ],
                    resources: {
                        requests: {
                            memory: '512Mi',   // Minimum memory guaranteed
                            cpu: '250m'       // Minimum CPU guaranteed (0.25 cores)
                        },
                        limits: {
                            memory: '1024Mi',  // Maximum memory allowed before OOMKilled
                            cpu: '500m'       // Maximum CPU allowed before throttling
                        }
                    },
                    volumeMounts: [
                        {
                            name: 'app-volume', //2nd volumeMounts file-server-container ke andar hai.
                            mountPath: '/app'
                        }
                    ]
                },
                {
                    name: 'sync-container',
                    image: '525390917683.dkr.ecr.ap-south-1.amazonaws.com/sync-service',
                    env: [
                        {
                            name: "PROJECT_ID",
                            value: projectId
                        },
                        {
                            name: "AWS_ACCESS_KEY_ID",
                            valueFrom: {
                                secretKeyRef: {
                                    name: 'aws',
                                    key: 'AWS_ACCESS_KEY_ID'
                                }
                            }
                        },
                        {
                            name: "AWS_SECRET_ACCESS_KEY",
                            valueFrom: {
                                secretKeyRef: {
                                    name: 'aws',
                                    key: 'AWS_SECRET_ACCESS_KEY'
                                }
                            }
                        }
                    ],
                    resources: {
                        requests: {
                            memory: '256Mi',
                            cpu: '100m'
                        },
                        limits: {
                            memory: '512Mi',
                            cpu: '300m'
                        }
                    },
                    volumeMounts: [
                        {
                            name: 'app-volume',
                            mountPath: '/app'
                        }
                    ]
                }
            ]
        }
    };

    const response = await k8sApi.createNamespacedPod({
        namespace: "default",
        body: podManifest
    });

    console.log('Pod successfully created!');
    console.log(response);

}

export async function createService(serviceName: string , podName : string){
    const serviceManifest = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata : {
            name : serviceName,
            labels:{
                app: podName //    service ka apna ek alag label hota ye service kis particular pod pe traffic leke jayegi us pod ka label kya hoga wo hume yaha pe dena rehta hai
            }
        },
        spec : {
            selector :{
                app: podName
            },
              ports: [
                {
                    name: 'preview-port',
                    protocol: 'TCP',
                    port: 80,
                    targetPort: 3000
                },
                {
                    name: 'file-server-port',
                    protocol: 'TCP',
                    port: 8000,
                    targetPort: 8080
                }
            ],
            type: 'ClusterIP'
        }
    }

    const response = await k8sApi.createNamespacedService({
        namespace : 'default',
        body : serviceManifest
    })

    console.log('Service successfully created!')
    console.log(response)
}

function isNotFound(error:unknown){
  return (error as {code?:number})?.code === 404
}

export async function deletePod(podName: string){
    try {
        await k8sApi.deleteNamespacedPod({namespace: "default" , name : podName})
        console.log(`Pod ${podName} deleted`)
    } catch (error) {
        if(isNotFound(error)){
            throw error
        }
    }
}

export async function deleteService(serviceName: string){
    try {
        await k8sApi.deleteNamespacedService({namespace : "default" , name : serviceName})
        console.log(`Service ${serviceName} deleted `)
    } catch (error) {
        if(isNotFound(error)){
            throw error
        }
    }
}
