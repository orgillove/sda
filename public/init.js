var app = angular.module('pokerApp', ["firebase"]);
var uid;
var socket = io();
var balance;

app.controller("MyAuthCtrl", ["$scope", "$rootScope", "$http", "$firebaseAuth",
  function($scope, $rootScope, $http, $firebaseAuth) {
    $scope.authObj = $firebaseAuth();
    $scope.authObj.$onAuthStateChanged(function(firebaseUser) {
      if (firebaseUser) {
          console.log("Signed in as:", firebaseUser.uid);
          uid = firebaseUser.uid
          document.getElementById("myId").innerHTML = "My id: " + uid;
          var xmlHttp = new XMLHttpRequest();
          xmlHttp.onreadystatechange = function() { 
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200){
              var response = JSON.parse(xmlHttp.responseText)
              console.log(response)
              balance = response.balance
              document.getElementById("balance").innerHTML = "Balance: " + response.balance
            }
          }
          xmlHttp.open("GET", "balance/" + uid, true); // true for asynchronous 
          xmlHttp.send(null);
      } else {
          console.log("Signed out");
      }
      socket.on('chat message', function(msg){
        $rootScope.$broadcast('chat message', msg)
      })
  });
  
  }
]);
app.config(function() {
  var config = {
    apiKey: "AIzaSyC9eny7iGTbbFJq0KKk7CTw7qKJSrX0hqY",
    authDomain: "kenpoker-461cd.firebaseapp.com",
    databaseURL: "https://kenpoker-461cd.firebaseio.com",
    storageBucket: "kenpoker-461cd.appspot.com"
  };
  firebase.initializeApp(config);
});