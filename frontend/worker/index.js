"use strict"

// https://stackoverflow.com/a/38690771
self.addEventListener("install", function(event) {
  console.log("event install")
  event.waitUntil(self.skipWaiting()) // Activate worker immediately
})

self.addEventListener("activate", function(event) {
  console.log("event activate")
  event.waitUntil(self.clients.claim()) // Become available to all pages
})

self.addEventListener("push", function(event) {
  console.log("event push")
  const data = JSON.parse(event.data.text())
  event.waitUntil(
    registration.showNotification(data.title, {
      body: data.message,
      icon: "/images/pwa-192.png"
    })
  )
})

self.addEventListener("notificationclick", function(event) {
  console.log("event notificationclick")
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0]
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i]
          }
        }
        return client.focus()
      }
      return clients.openWindow("/")
    })
  )
})
