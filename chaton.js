//
// NB: This script is read in both the main html and inner frame html
//

//=================================================================
// Functions for outer html
//

// Post interface ----------------------------------

function post() {
  setNickCookie($F('post-remember'));
  if ($F('post-nick') == '' || $F('post-text') == '') return;
  disablePost();
  new Ajax.Request("@@httpd-url@@@@url-path@@@@cgi-script@@",
    {
      parameters : {
        nick: $F('post-nick'), 
	text: $F('post-text')
      },
      onSuccess : function (t) { enablePost(true); },
      onFailure : function (t) { enablePost(false); },
      onException : function (r, e) { enablePost(false); }
    });
}

function textKey(e) {
  if ($('post-text').disabled) return;
  var key = (e.which || e.keyCode);
  if (key == Event.KEY_RETURN) { post(); }
}

function disablePost() {
  $('post-submit').disabled = true;
  $('post-nick').disabled = true;
  $('post-text').disabled = true;
  $('post-form').disabled = true;
}

function enablePost(clearp) {
  $('post-submit').disabled = false;
  $('post-nick').disabled = false;
  $('post-text').disabled = false;
  $('post-form').disabled = false;
  if (clearp) { $('post-text').clear(); }
}

function setNickname() {
    var cookies = document.cookie.split(';');
    var len = cookies.length;
    for (var i = 0; i < len; i++) {
        var sc = cookies[i].strip();
        if (sc.startsWith('chaton-nickname=')) {
            var nick = sc.substring('chaton-nickname='.length, sc.length);
            $('post-nick').value = unescape(nick);
            $('post-remember').checked = true;
            break;
        }
    }
}

function setNickCookie(set) {
    if (set) {
        document.cookie = 'chaton-nickname=' + escape($F('post-nick'))
            + ';expires=Tue, 19 Jan 2038 00:00:00 GMT'
            + ';path=@@cookie-path@@';
    } else {
        document.cookie = 'chaton-nickname='
            + ';expires=Thu, 01-Jan-1970 00:00:01 GMT'
            + ';path=@@cookie-path@@';
    }
}
   
// Sequence count monitor -----------------------------

var messageMonitorRunning = false;
var messageMonitorContinue = false;
var currentMessageNum = -1;
var viewedMessageNum = -1;

function setTitle() {
  if (messageMonitorContinue) {
    var num = currentMessageNum - viewedMessageNum;
    if (num > 0) {
      window.document.title = '[' + num + '] Chaton @@room-name@@';
      return;
    }
  }
  window.document.title = 'Chaton @@room-name@@';
}

function messageMonitorRun() {
  messageMonitorContinue = true;
  if (!messageMonitorRunning) {
    messageMonitorRunning = true;
    currentMessageNum = viewedMessageNum = -1;
    fetchMessageCount();
  }
}

function messageMonitorStop() {
  messageMonitorContinue = false;
  currentMessageNum = viewedMessageNum = -1;
  setTitle();
}

function fetchMessageCount() {
  if (!messageMonitorContinue) {
    messageMonitorRunning = false;
    return;
  }
  new Ajax.Request("@@httpd-url@@@@url-path@@var/seq",
    {
      method: 'get',
      evalJSON: false,
      onSuccess: fetchMessageCountCB,
      onException: function (r,e) { messageMonitorStop(); }
    });
}

function fetchMessageCountCB(t) {
  if (!messageMonitorContinue) {
    messageMonitorRunning = false;
    return;
  }
  var cnt = parseInt(t.responseText);
  if (currentMessageNum < 0 || currentMessageNum > cnt) {
    currentMessageNum = viewedMessageNum = cnt;
  } else {
    currentMessageNum = cnt;
  }
  setTitle();
  setTimeout(fetchMessageCount, 7000);
}

// Initialization -------------------------------------
function initMainBody() {
  $('post-text').observe('keypress', textKey);
  $('the-body').onmouseover = function () { messageMonitorStop(); }
  $('the-body').onmouseout  = function () { messageMonitorRun(); }
  setNickname();
}

//=================================================================
// Functions for inner html
//

var pos = 0;
var seq = 0;

function fetchContent() {
    seq = (seq+1)%100;
    var ts = ((new Date).getTime()).toString(36) + seq.toString(36);
    new Ajax.Request('/?t=' + ts + '&p=' + pos,
      {
          method: 'get',
          evalJSON: 'force',
          onSuccess: function(t) { 
              insertContent(t.responseJSON); 
          },
          // When Comet server shuts down, Firefox triggers onException,
          // while IE7 triggers onFailure.
          onFailure: function(t) { fetchRetry(); },
          onException: function(r, e) { fetchRetry(); }
      });
}

function fetchRetry() {
    showStatus('Connection Lost.  Retrying...', 'status-alert');
    setTimeout(resumeFetch, 10000);
}

function insertContent(json) {
    if (json.ver != '@@version@@') {
        // The comet server is updated.  We replace the entire document.
        document.location.href = '@@httpd-url@@:@@comet-port@@/';
        return;
    }
    showStatus('Connected ('+json.nc+' user'+(json.nc>1?'s':'')+' chatting)',
               'status-ok');
    if (json.pos < pos || json.refresh) {
        $('view-pane').update('');
    }
    $('view-pane').insert(json.text);
    pos = json.pos;
    scrollToBottom();
    fetchContent();
}

function resumeFetch() {
    showStatus('Connecting...', 'status-ok');
    fetchContent();
}

function showStatus(text, klass) {
    var st = $('status-line');
    st.removeChild(st.childNodes.item(0));
    st.insert('<span class=\"'+klass+'\">'+text+'</span>');
}

function checkImageSize(img) {
    var img = $(img);
    if (img.width > img.height) {
        if (img.width > @@img-size-limit@@) img.addClassName('wshrunk');
    } else {
        if (img.height > @@img-size-limit@@) img.addClassName('hshrunk');
    }
    img.style.display = 'inline';
    img.removeClassName('hide-while-loading');
    scrollToBottom();
}

function scrollToBottom() {
    var sp = $('status-pane');
    if (sp) sp.scrollTo();
}