(function(){
  var newCardId, boardId = "55ce3711810825c54bc713e0", newRequestCol = "591b969be20d5adba9c578ab", user, organisation, trelloLink;
  var client = ZAFClient.init();

  client.get("ticket.organization").then(function(data){
    organisation = data['ticket.organization'].name;
  });
  client.get("ticket.customField:custom_field_30806487").then(function(data){
    trelloLink = data['ticket.customField:custom_field_30806487'] || "";
    Trello.authorize({
      type: 'popup',
      name: 'Getting Started Application',
      scope: {
        read: 'true',
        write: 'true' },
      expiration: 'never',
      success: authenticationSuccess,
      error: authenticationFailure
    });
  });

  function authenticationSuccess() {
     console.log('Successful authentication');
     if(trelloLink !== ""){
       showInfo();
     }else{
       Trello.get('boards/'+boardId+'/lists',function renderLists(columns) {
         Trello.get('/lists/'+newRequestCol+'/cards',function renderCards(cards){
           Trello.get('members/me',function getUser(userObj){
              user = "@"+userObj.username;
           });
           client.invoke('resize',{height: 271});
           renderContent("#select_template",{cards: cards, columns: columns});
         });
       });
     }
   };

  function authenticationFailure(response) {
    console.log('Failed authentication');
    showError(response);
  };

  function renderContent(target,data){
    var source = $(target).html();
    var template = Handlebars.compile(source);
    var html = template(data);
    $("#content").html(html);
  }
  function showError(response) {
    var error_data = {
    'status': response.status,
    'statusText': response.statusText
  };
    renderContent("#error_template",error_data);
  }

  function showInfo(){
    client.invoke('resize',{height: 142});
    var short = trelloLink.split("/")[4] || newCardId;
    var cardObj = {};
    Trello.get('cards/'+short,function(card){
      cardObj.name = shortenName(card.name,35);
      cardObj.lastUpdate = formatDate(card.dateLastActivity);
      cardObj.link = card.shortUrl;
      Trello.get('boards/'+card.idBoard,function(board){
        cardObj.boardName = shortenName(board.name,49);
        Trello.get('/lists/'+card.idList,function(list){
          cardObj.listName = list.name;
          cardObj.location = ""+cardObj.boardName + " / "+ cardObj.listName;
          renderContent('#open_template',cardObj);
        })
      });
    });
  }

  function shortenName(string,length){
      return string.substr(0,length).trim().concat("...");
  }

  function formatDate(date) {
    var cdate = new Date(date);
    var options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric"
    };
    date = cdate.toLocaleDateString("en-gb", options);
    return date;
  }

  $(document.body).on('click','#copy_card',function(evt){
    var cardSource = $("#card_list").val();
    var column = $("#columns_list").val();
    var newCardName = $("#card_name").val();

    var cardObj = {
      idBoard: boardId,
      idCardSource: cardSource,
      idList: column,
      keepFromSource :["due", "checklists", "labels", "attachments"],
      name: newCardName,
      pos:"top",
      subscribed: true
    }
    //Create new card
    Trello.post('/cards/', cardObj,function(data) {
      if(data.hasOwnProperty('id')){
        newCardId = data.id;
        client.set('ticket.customField:custom_field_30806487', data.shortUrl);
        client.invoke('resize',{height: 160});
        renderContent("#description_template",{});
      }else{
        showError({statusText: "Failed to create card", status: "Failed"})
      }
    });
  });


  $(document.body).on('click','#update_checkbox',function(evt){
    var checkItemObj;
    $("input:checked").each(function(){
      checkItemObj = {
        id: this.value,
        state: true
      }
      console.log(newCardId);

      Trello.put('/cards/'+newCardId+'/checkItem/'+this.value,checkItemObj,function(){});
    });
    showInfo();
  });


  $(document.body).on('click','#update_description',function(evt){
    var description = $("#description").val();
    var cardObj = {
      value: description
    };
    Trello.put('/cards/'+newCardId+'/desc',cardObj,function(data){
      Trello.get('/cards/'+newCardId+'/checklists',function(data){
        var checkLists = [],checkItemObj;
        for (var i = 0; i < data.length; i++) {
          if(/^Submitter\:/i.test(data[i].name) && data[i].checkItems.length !== 0){
            checkLists.push(data[i]);
          }else if(/Submitter\:\s+Requesting.+?Affected\s+Clients/.test(data[i].name)){
            checkItemObj = {
              idChecklist: data[i].id,
              name: ""+user+" / "+ organisation,
              pos: "top"
            }
            Trello.post('/cards/'+newCardId+'/checklist/'+data[i].id+'/checkItem',checkItemObj,function(){});
          }else if (/^Submitter$/.test(data[i].name)) {
            var id = data[i].checkItems[0].id;

            checkItemObj = {
            id: id,
            name: user
            }
            Trello.put('/cards/'+newCardId+'/checkItem/'+id,checkItemObj,function(){});
          }
        }
        if(checkLists.length !== 0){
            client.invoke('resize',{height: 345});
            renderContent("#checkbox_template",{checkLists: checkLists});
        }else{
          showInfo();
        }
      });
    });
  });

  $(document.body).on('keydown','#card_name',function(evt){
    if($(this).val().length > 1){
      $("#copy_card").attr('disabled',false);
    }else {
      $("#copy_card").attr('disabled',true);
    }
  });

  $(document.body).on('keydown','#description',function(evt){
    if($(this).val().length > 1){
      $("#update_description").attr('disabled',false);
    }else {
      $("#update_description").attr('disabled',true);
    }
  });

  $(document.body).on("change","ul input",function(){
    if($("input:checked").length !== 0){
	     $("#update_checkbox").attr('disabled',false);
     }else{
       $("#update_checkbox").attr('disabled',true);
     }
   });
}());
