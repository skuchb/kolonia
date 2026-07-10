import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("Add to Cloudflare secrets / .dev.vars:\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:contact@kolonia.app");
