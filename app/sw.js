import idb from 'idb';

var cacheID = "mws-restaurant-cache";

var dbPromise = idb.open('resreviews-db',1,function(upgradeDb){
  var store = upgradeDb.createObjectStore('restaurants',{
    keyPath: 'id'
  });
  store.createIndex('by-id','id');
});

var urlsToCache = [
  '/',
  '/index.html',
  '/restaurant.html',
  '/css/styles.css',
  '/js/dbhelper.js',
  '/js/main.js',
  '/js/restaurant_info.js',
  '/img/1.jpg',
  '/img/2.jpg',
  '/img/3.jpg',
  '/img/4.jpg',
  '/img/5.jpg',
  '/img/6.jpg',
  '/img/7.jpg',
  '/img/8.jpg',
  '/img/9.jpg',
  '/img/10.jpg',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open('restaurant-static-v1')
      .then(function (cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});


self.addEventListener('activate', function(event) {
  console.log('Finally active. Ready to start serving content!');
});

// self.addEventListener('fetch', function(event) {
//   event.respondWith(
//     caches.match(event.request)
//       .then(function(response) {
//         // Cache hit - return response
//         if (response) {
//           return response;
//         }
//         return fetch(event.request);
//       }
//     )
//   );
// });


self.addEventListener("fetch", event => {
  let cacheRequest = event.request;
  let cacheUrlObj = new URL(event.request.url);
  if (event.request.url.indexOf("restaurant.html") > -1) {
    const cacheURL = "restaurant.html";
    cacheRequest = new Request(cacheURL);
  }

  // Checking if Data from Database is being called
  const checkURL = new URL(event.request.url);
  if (checkURL.port === "1337") {
    const parts = checkURL
      .pathname
      .split("/");
    let id = checkURL
      .searchParams
      .get("restaurant_id") - 0;
    if (!id) {
      if (checkURL.pathname.indexOf("restaurants")) {
        id = parts[parts.length - 1] === "restaurants"
          ? "-1"
          : parts[parts.length - 1];
      } else {
        id = checkURL
          .searchParams
          .get("restaurant_id");
      }
    }
    handleAJAXEvent(event, id);
    console.log("DATA CALLED FROM DATABASE");
  } else {
    handleNonAJAXEvent(event, cacheRequest);
    console.log("DATA NOT CALLED FROM DATABASE");
  }
});

const handleAJAXEvent = (event, id) => {
  // Only use caching for GET events
  if (event.request.method !== "GET") {
    return fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(json => {
        return json
      });
  }

  // Split these request for handling restaurants vs reviews
  if (event.request.url.indexOf("reviews") > -1) {
    handleReviewsEvent(event, id);
  } else {
    handleRestaurantEvent(event, id);
  }
}

const handleReviewsEvent = (event, id) => {
  event.respondWith(dbPromise.then(db => {
    return db
      .transaction("reviews")
      .objectStore("reviews")
      .index("restaurant_id")
      .getAll(id);
  }).then(data => {
    return (data.length && data) || fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(data => {
        return dbPromise.then(idb => {
          const itx = idb.transaction("reviews", "readwrite");
          const store = itx.objectStore("reviews");
          data.forEach(review => {
            store.put({id: review.id, "restaurant_id": review["restaurant_id"], data: review});
          })
          return data;
        })
      })
  }).then(finalResponse => {
    if (finalResponse[0].data) {
      // Need to transform the data to the proper format
      const mapResponse = finalResponse.map(review => review.data);
      return new Response(JSON.stringify(mapResponse));
    }
    return new Response(JSON.stringify(finalResponse));
  }).catch(error => {
    return new Response("Error fetching data", {status: 500})
  }))
}

const handleRestaurantEvent = (event, id) => {
  // Check the IndexedDB to see if the JSON for the API has already been stored
  // there. If so, return that. If not, request it from the API, store it, and
  // then return it back.
  event.respondWith(dbPromise.then(db => {
    return db
      .transaction("restaurants")
      .objectStore("restaurants")
      .get(id);
  }).then(data => {
    return (data && data.data) || fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(json => {
        return dbPromise.then(db => {
          const tx = db.transaction("restaurants", "readwrite");
          const store = tx.objectStore("restaurants");
          store.put({id: id, data: json});
          return json;
        });
      });
  }).then(finalResponse => {
    return new Response(JSON.stringify(finalResponse));
  }).catch(error => {
    return new Response("Error fetching data", {status: 500});
  }));
};

const handleNonAJAXEvent = (event, cacheRequest) => {
  // Check if the HTML request has previously been cached. If so, return the
  // response from the cache. If not, fetch the request, cache it, and then return
  // it.
  event.respondWith(caches.match(cacheRequest).then(response => {
    return (response || fetch(event.request).then(fetchResponse => {
      return caches
        .open(cacheID)
        .then(cache => {
          if (fetchResponse.url.indexOf("browser-sync") === -1) {
            cache.put(event.request, fetchResponse.clone());
          }
          return fetchResponse;
        });
    }).catch(error => {
      if (event.request.url.indexOf(".jpg") > -1) {
        return caches.match("/img/na.png");
      }
      return new Response("Application is not connected to the internet", {
        status: 404,
        statusText: "Application is not connected to the internet"
      });
    }));
  }));
};
