const faqString = `
**How can I expose the Ollama server?**
By default, Ollama allows cross origin requests from 127.0.0.1 and 0.0.0.0.
To support more origins, you can use the OLLAMA_ORIGINS environment variable:
\`\`\`
OLLAMA_ORIGINS=${window.location.origin} ollama serve
\`\`\`
Also see: https://github.com/jmorganca/ollama/blob/main/docs/faq.md
`;

const textBoxBaseHeight = 40;
let imageHeaders = [];
let imageStorage = []; // input image data
const chatHistoryElement = document.getElementById("chat-history");
const imageInputElement = document.getElementById("image-input");
const fileUploadElement = document.getElementById("upload-file");
const userInputElement = document.getElementById('user-input');

// change settings of marked from default to remove deprecation warnings
marked.use({
  mangle: false,
  headerIds: false
});

function updateModelInQueryString(model) {
  if (window.history.replaceState && 'URLSearchParams' in window) {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("model", model);
    const newPathWithQuery = `${window.location.pathname}?${searchParams.toString()}`;
    window.history.replaceState(null, '', newPathWithQuery);
  }
}

async function populateModels() {
  document.getElementById('send-button').addEventListener('click', submitRequest);
  try {
    const data = await getModels();
    const selectElement = document.getElementById('model-select');
    selectElement.onchange = () => updateModelInQueryString(selectElement.value);
    data.models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.name;
      option.innerText = model.name;
      selectElement.appendChild(option);
    });
    const queryParams = new URLSearchParams(window.location.search);
    const requestedModel = queryParams.get('model');
    if ([...selectElement.options].map(o => o.value).includes(requestedModel)) {
      selectElement.value = requestedModel;
    } else if (selectElement.options.length) {
      selectElement.value = selectElement.options[0].value;
      updateModelInQueryString(selectElement.value);
    }
  } catch (error) {
    document.getElementById('errorText').innerHTML = DOMPurify.sanitize(marked.parse(`Ollama-ui was unable to communitcate with Ollama due to the following error:\n\n\`\`\`${error.message}\`\`\`\n\n---------------------\n` + faqString));
    let modal = new bootstrap.Modal(document.getElementById('errorModal'));
    modal.show();
  }
}

function adjustPadding() {
  const inputBoxHeight = document.getElementById('input-area').offsetHeight;
  const scrollWrapper = document.getElementById('scroll-wrapper');
  scrollWrapper.style.paddingBottom = `${inputBoxHeight + 15}px`;
}

const autoResizePadding = new ResizeObserver(() => {
  adjustPadding();
});
autoResizePadding.observe(document.getElementById('input-area'));

function getSelectedModel() {
  return document.getElementById('model-select').value;
}

const scrollWrapper = document.getElementById('scroll-wrapper');
let isAutoScrollOn = true;

const autoScroller = new ResizeObserver(() => {
  if (isAutoScrollOn) {
    scrollWrapper.scrollIntoView({ behavior: "smooth", block: "end" });
  }
});

let lastKnownScrollPosition = 0;
let ticking = false;

document.addEventListener("scroll", (event) => {
  if (!ticking && isAutoScrollOn && window.scrollY < lastKnownScrollPosition) {
    window.requestAnimationFrame(() => {
      isAutoScrollOn = false;
      ticking = false;
    });
    ticking = true;
  } else if (!ticking && !isAutoScrollOn && window.scrollY > lastKnownScrollPosition && window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 30) {
    window.requestAnimationFrame(() => {
      isAutoScrollOn = true;
      ticking = false;
    });
    ticking = true;
  }
  lastKnownScrollPosition = window.scrollY;
});

function extractChatHistory() {
  const chatHistoryDiv = document.getElementById('chat-history');
  const messages = [];
  let sysPrompt = document.getElementById('system-prompt').value; 
  if (sysPrompt) {  
    messages.push({
      role: 'system',
      content: document.getElementById('system-prompt').value,
    });
  }
  
  const messageElements = chatHistoryDiv.children;
  for (let i = 0; i < messageElements.length; i++) {
    let messageElement = messageElements[i];
    let role = 'user'; 
    let content = '';
    let images = [];
    
    if (messageElement.classList.contains('response-message')) role = 'assistant';
    const blockTextElement = messageElement.querySelector('div.block-text');
    if (blockTextElement) content = blockTextElement.textContent.trim();
    const blockImageElement = messageElement.querySelector('div.block-image');
    if (blockImageElement) {
      const imageElements = blockImageElement.querySelectorAll('img');
      for (let j = 0; j < imageElements.length; j++) images.push(imageElements[j].src.split(',')[1]);
    }
    
    messages.push({
      role: role,
      content: content,
      images: images
    });
  }
  return messages;
}

function formatDurationSimple(ns) {
  const totalSeconds = Math.floor(ns / 1e9);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, '0')+':'+String(seconds).padStart(2, '0');
}

async function submitRequest() {
  document.getElementById('chat-container').style.display = 'block';

  let data = {
    model: getSelectedModel(),
    stream: document.getElementById('chat-think').checked,
    temperature: document.getElementById('chat-temp').value,
  };
  
  let requestDiv = document.createElement('div');
  requestDiv.className = 'mb-2 user-message';
  let requestText = document.createElement('div'); 
  requestText.className = 'block-text';
  requestText.innerHTML = userInputElement.value;
  requestDiv.appendChild(requestText);
  let requestImage = document.createElement('div'); 
  requestImage.className = 'block-image';
  for (let i = 0; i < imageStorage.length; i++) {
    let img = document.createElement('img');
    img.src = imageHeaders[i] + imageStorage[i];
    requestImage.appendChild(img);
  }
  if (imageStorage.length > 0) requestDiv.appendChild(requestImage);
  chatHistoryElement.appendChild(requestDiv);
  data.messages = extractChatHistory();
  if (imageStorage.length > 0) document.getElementById("upload-file").click();

  let responseDiv = document.createElement('div');
  responseDiv.className = 'response-message mb-2 text-start';
  responseDiv.style.minHeight = '3em';
  let spinner = document.createElement('div');
  spinner.className = 'spinner-border text-light';
  spinner.setAttribute('role', 'status');
  responseDiv.appendChild(spinner);
  let responseText = document.createElement('div');
  responseText.className = 'block-text';
  responseDiv.appendChild(responseText);
  chatHistoryElement.appendChild(responseDiv);

  let interrupt = new AbortController();
  let stopButton = document.createElement('button');
  stopButton.className = 'btn btn-danger';
  stopButton.innerHTML = 'Stop';
  stopButton.onclick = (e) => {
    e.preventDefault();
    interrupt.abort('Stop button pressed');
  };

  const sendButton = document.getElementById('send-button');
  sendButton.insertAdjacentElement('beforebegin', stopButton);
  autoScroller.observe(responseDiv);

  postRequest(data, interrupt.signal)
    .then(async response => {
      await getResponse(response, parsedResponse => {
        const word = parsedResponse.message && parsedResponse.message.content;
        if (parsedResponse.done) {
          let tmEl = document.createElement('div');
          tmEl.className = 'timer-icon';
          tmEl.innerHTML = '⏱ ' + formatDurationSimple(parsedResponse.total_duration);
          responseDiv.appendChild(tmEl);
          if (navigator.clipboard) {
		    let btnCopyEl = document.createElement('button');
		    btnCopyEl.className = 'btn btn-secondary copy-button';
		    btnCopyEl.innerHTML = '⎗';
		    btnCopyEl.onclick = () => {
		      navigator.clipboard.writeText(responseText.textContent);
		    };
		    responseDiv.appendChild(btnCopyEl);
          }
          if (parsedResponse.images) {
            // if return generated image
            let responseImage = document.createElement('div');
            responseImage.className = 'block-image';
            responseDiv.appendChild(responseImage);
          }
        }
        if (word !== undefined && word !== "") {
          if (responseText.hidden_text === undefined) {
            responseText.hidden_text = "";
          }
          responseText.hidden_text += word;
          responseText.innerHTML = DOMPurify.sanitize(marked.parse(responseText.hidden_text));
          renderMathInElement(responseText, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        }
      });
    })
    .then(() => {
      stopButton.remove();
      spinner.remove();
    })
    .catch(error => {
      if (error !== 'Stop button pressed') {
        console.error(error);
      }
      stopButton.remove();
      spinner.remove();
    });

    userInputElement.value = '';
    $(userInputElement).css("height", textBoxBaseHeight + "px");
}

window.onload = () => {
  updateChatList();
  populateModels();
  adjustPadding();
  document.getElementById("delete-chat").addEventListener("click", deleteChat);
  document.getElementById("new-chat").addEventListener("click", startNewChat);
  document.getElementById("saveName").addEventListener("click", saveChat);
  document.getElementById("chat-select").addEventListener("change", loadSelectedChat);
  document.getElementById("host-address").addEventListener("change", setHostAddress);
  document.getElementById("system-prompt").addEventListener("change", setSystemPrompt);
  userInputElement.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitRequest();
  });
  fileUploadElement.addEventListener("click", () => {
    if (fileUploadElement.classList.contains('btn-success')) {
      imageHeaders = [];
      imageStorage = [];
      fileUploadElement.classList.replace('btn-success', 'btn-secondary');
      fileUploadElement.innerHTML = '📎';
    } else {
      imageInputElement.click();
    }
  });
  imageInputElement.addEventListener("change", handleUploadFile);
  //document.getElementById("clip-paste").addEventListener("click", async () => {
  //  const clipboardText = await navigator.clipboard.readText();
  //  userInputElement.value = clipboardText;  
  //});
  userInputElement.addEventListener("paste", (event) => {
    event.preventDefault();
    if (event.clipboardData && event.clipboardData.items) {
      insertFromClipboard(event.clipboardData.items);
    }
  });
  /* --- */
  userInputElement.focus();
}
    
async function handleUploadFile(event) {
  const files = Array.from(event.target.files);
  if (files.length > 0) {
    imageStorage = [];
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        let imageData = e.target.result.split(',');
        imageHeaders.push(imageData[0] + ',');
        imageStorage.push(imageData[1]);
        fileUploadElement.classList.replace('btn-secondary', 'btn-success');
        fileUploadElement.innerHTML = files[0].name;
      };
      reader.readAsDataURL(files[0]);
    } catch (error) {
      console.error("Ошибка при кодировании файла:", error);
    } finally {
      imageInputElement.value = '';
    }
  }
}

function insertFromClipboard(items) {
  if (items.lenght == 0) return false;
  item = items[0];
  if (['image/png', 'image/jpeg'].includes(item.type)) {
    // , 'image/gif', 'image/webp'
    const reader = new FileReader();
    reader.onload = (e) => {
      let imageData = e.target.result.split(',');
      imageHeaders.push(imageData[0] + ',');
      imageStorage.push(imageData[1]);
      fileUploadElement.classList.replace('btn-secondary', 'btn-success');
      fileUploadElement.innerHTML = '[clipboard]';
    };
    reader.readAsDataURL(item.getAsFile());
  } else if (['text/plain', 'text/html'].includes(item.type)) {
    item.getAsString( (s) => { 
      if (item.type == 'text/html') s = DOMPurify.sanitize(s, { ALLOWED_TAGS: [] });
      const old_s = userInputElement.value;
      userInputElement.value = 
        old_s.substring(0, userInputElement.selectionStart) + 
        s + 
        old_s.substring(userInputElement.selectionEnd);
      autoGrow(userInputElement);
    });
  }
}

function deleteChat() {
  const selectedChat = document.getElementById("chat-select").value;
  localStorage.removeItem(selectedChat);
  updateChatList();
}

function saveChat() {
  const chatName = document.getElementById('userName').value;
  const bootstrapModal = bootstrap.Modal.getInstance(document.getElementById('nameModal'));
  bootstrapModal.hide();
  if (chatName === null || chatName.trim() === "") return;
  const history = chatHistoryElement.innerHTML;
  const context = chatHistoryElement.context;
  const systemPrompt = document.getElementById('system-prompt').value;
  const model = getSelectedModel();
  localStorage.setItem(chatName, JSON.stringify({ history: history, context: context, system: systemPrompt, model: model }));
  updateChatList();
}

function loadSelectedChat() {
  const selectedChat = document.getElementById("chat-select").value;
  const obj = JSON.parse(localStorage.getItem(selectedChat));
  chatHistoryElement.innerHTML = obj.history;
  chatHistoryElement.context = obj.context;
  document.getElementById("system-prompt").value = obj.system;
  updateModelInQueryString(obj.model);
  document.getElementById('chat-container').style.display = 'block';
}

function startNewChat() {
  chatHistoryElement.innerHTML = null;
  chatHistoryElement.context = null;
  document.getElementById('chat-container').style.display = 'none';
  updateChatList();
}

function updateChatList() {
  const chatList = document.getElementById("chat-select");
  chatList.innerHTML = '<option value="" disabled selected>Select a chat</option>';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === "host-address" || key == "system-prompt") continue;
    const option = document.createElement("option");
    option.value = key;
    option.text = key;
    chatList.add(option);
  }
}

function autoGrow(element) {
  const maxHeight = 200;
  const numberOfLines = $(element).val().split('\n').length;
  $(element).css("height", "auto");
  let newHeight = element.scrollHeight;
  if (numberOfLines === 1) {
    newHeight = textBoxBaseHeight;
  } else if (newHeight > maxHeight) {
    newHeight = maxHeight;
  }
  $(element).css("height", newHeight + "px");
}
