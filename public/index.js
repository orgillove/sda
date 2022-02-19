

function signOut(){
  firebase.auth().signOut();
}


function initApp(socket){
  firebase.auth().onAuthStateChanged(function(user) {
    if(user){
      //document.getElementById("uid").value = user.uid
      //document.getElementById("navHome").className = "active"
      socket.emit('login', user.uid)
    }
    else{
      window.location.href = "/login"
    }
  })
}

/*window.onload = function() {
  initApp();
};*/

function addCard(card){
  //var selector = card.className.split(" ");
  //var cardName = selector[1];
  //var clonedDiv = $('.'+cardName).clone();
  //clonedDiv.attr("onclick", "returnCard(this)"); 
  //clonedDiv.addClass("on-table");
  //clonedDiv.css("left", "");
  var div = "<div class='card on-table' id='test' style='background-image:url(imgs/" + card + ".png)'></div>"
  $('.picked-cards-area').append(div);
  //$("."+cardName +":not(.on-table)").hide();

  //pickedCards.push(cardName);

}

$(function () {
  /*function takeSeat(seatNum){
    socket.emit('take seat', {uid:uid, seat:seatNum})
  }*/
  //addCard('3S')
  //$('.on-table').remove();
  //document.getElementByClass(picke)
  initApp(socket)
  var stack = document.getElementById('stack')
  var stackSize = 200;
  var folded = true;
  var amountBet;
  var currentBet;
  var player;
  var mySeat;
  stack.innerHTML = stackSize;
  var slider = document.getElementById('m')
  slider.max = stackSize;
  slider.oninput = function() {
    document.getElementById("raise").innerHTML = "Raise " + this.value
  }
  document.getElementById('seat0').onclick = function(){
    mySeat = 0;
    socket.emit('take seat', {uid:uid, seat:0})
  }
  document.getElementById('seat1').onclick = function(){
    mySeat = 1;
    socket.emit('take seat', {uid:uid, seat:1})
  }
  document.getElementById('seat2').onclick = function(){
    mySeat = 2;
    socket.emit('take seat', {uid:uid, seat:2})
  }
  document.getElementById('seat3').onclick = function(){
    mySeat = 3;
    socket.emit('take seat', {uid:uid, seat:3})
  }
  document.getElementById('fold').onclick = function(){
    socket.emit('fold', {uid:uid})
  }
  $('#bet').submit(function(){
    var bet = parseInt($('#m').val())
    if (bet <= stackSize + amountBet){
      socket.emit('bet', bet);
      /*$('#m').val(1);
      stackSize -= bet
      stack.innerHTML = stackSize
      slider.max = stackSize*/
    }
    return false;
  });
  document.getElementById("checkCall").onclick = function (){
    //all in
    //console.log(currentBet)
    //console.log(amountBet)
    if (currentBet < stackSize + amountBet){
      socket.emit('bet', currentBet)
    }
    else{
      socket.emit('bet', stackSize + amountBet)
    }
  }
  document.getElementById("standUp").onclick = function(){
    socket.emit("stand up", uid)
  }
  /*$('#seat').submit(function(){
    var radios = document.getElementsByName('seat');
    for (var radio of radios){
      if (radio.checked){

        socket.emit('take seat', {uid:uid, seat:radio.value});
      }
    }
    return false;
  })*/
  $('#message_form').submit(function(){
    socket.emit('chat message', {uid: uid, msg: $('#message_input').val(), timeStamp: new Date()});
    $('#message_input').val('');
    return false;
  });
  

  socket.on('cards', function(cards){
    //fix: do not assume myseat is defined
    if (mySeat != null){
      document.getElementById("seat" + mySeat + "_card0").src = "imgs/" + cards[0] + ".png"
      document.getElementById("seat" + mySeat + "_card1").src = "imgs/" + cards[1] + ".png"
    }
  })


  socket.on('game state', function(state){
    var found = false;
    var openSeats = []
    for (var i = 0; i < 4; i++){
      var player = state.seats[i]
      if (player !== null){
        if(player.uid == uid){
          mySeat = i
          console.log(mySeat)
          found = true
          stackSize = parseInt(player.stackSize)
          folded = player.folded
          amountBet = parseInt(player.amountBet)
          stack.innerHTML = stackSize;
          currentBet = state.bet
          //console.log(currentBet + state.previousRaise)
          //console.log(stackSize + amountBet)
          if (currentBet + state.previousRaise > stackSize + amountBet){
            slider.min = stackSize + amountBet;
            slider.disabled = true;
            document.getElementById("raise").innerHTML = "All-in " + (stackSize + amountBet)
          }
          else{
            slider.disabled = false
            slider.min = currentBet + state.previousRaise
            document.getElementById("raise").innerHTML = "Raise " + (currentBet + state.previousRaise);
          }
          slider.max = stackSize + amountBet;
          slider.value = currentBet + state.previousRaise;
          
          if (currentBet === amountBet){
            document.getElementById("checkCall").innerHTML = "Check"
          }
          else if (currentBet < stackSize + amountBet) {
            document.getElementById("checkCall").innerHTML = "Call " + (state.bet - amountBet)
          }
          else{
            document.getElementById("checkCall").innerHTML = "All-in"
          }
        }
        document.getElementById("seat" + i + "info").innerHTML = 
        "id: " + player.uid + " Stack: " + player.stackSize + " Amount Bet: " + player.amountBet + " Folded: " + player.folded
        
      }
      else{
        openSeats.push(i)
        document.getElementById("seat" + i + "info").innerHTML = ""
      }
      
    }
    document.getElementById("pot").innerHTML = state.pot
    $('.on-table').remove();
    if (state.community){
      for (var j = 0; j < state.community.length; j++){
        addCard(state.community[j]) 
      }
    }
    for (var i = 0; i < 4; i++){
      document.getElementById("seat" + i).style.display = "none"
    }
    if (!found){
      for (var seat of openSeats){
        document.getElementById("seat" + seat).style.display = "block"
      }
    }
    if (state.button != null){
      document.getElementById("seat" + state.button + "info").innerHTML += " (button) "
    }
    document.getElementById("betSpan").style.display = "none"
    if (state.turn != null){
      document.getElementById("seat" + state.turn + "info").innerHTML += " (action) "
      if (state.seats[state.turn].uid == uid){
        document.getElementById("betSpan").style.display = "block"
      }
    }
  })

  socket.on('balance', function(diff){
    balance += diff;
    document.getElementById('balance').innerHTML = "Balance: " + balance 
  })


  socket.on('showdown', function(cards){
    console.log(cards)
    for (var i = 0; i < 4; i++){
      
    }
  })
  socket.on('connect', function(s){
    /*var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        var messages = JSON.parse(this.responseText)
        for (var message of messages){
          console.log(message.text)
        }
      }
    };
    xhttp.open("GET", "/messages", true);
    xhttp.send();*/
  })
});