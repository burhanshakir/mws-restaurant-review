
var dbPromise = idb.open('test-db',1,function(upgradeDb){
  var keyValStore = upgradeDb.createObjectStore('keyval');
  keyValStore.put('world','hello');
});

// Getting Values from idb

dbPromise.then(function(db){
  var tx = db.transaction('keyval');
  var keyValStore = tx.objectStore('keyval');
  return keyValStore.get('hello');
}).then(function(val){
  console.log('The value of "hello" is:', val);
});

//Putting value in idb

dbPromise.then(function(db){
  var tx = db.transaction('keyval','readwrite');
  var keyValStore = tx.objectStore('keyval');
  keyValStore.put('bar','foo');
  return tx.complete;
}).then(function(val){
  console.log('Added foo:bar to keyval');
});


var idbPromise = idb.open('resreviews-db',1,function(upgradeDb){
  var store = upgradeDb.createObjectStore('restaurants',{
    keyPath: 'id'
  });
  store.createIndex('by-id','id');
});
