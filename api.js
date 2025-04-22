const rebuildRules = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id)
  ? async (domain) => {
    const rules = [{
      id: 1,
      condition: {
        requestDomains: [domain], // Simplified array creation
      },
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'origin',
          operation: 'set',
          value: `http://${domain}`,
        }],
      },
    }];
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1], // Hardcoded ID since it's always 1
      addRules: rules,
    });
  }
  : undefined;

var ollama_host = localStorage.getItem("host-address") || 'http://192.168.100.5:13960'; // Concise initialization
const ollamaHostElement = document.getElementById("host-address");
ollamaHostElement.value = ollama_host; // Set value directly

var ollama_system_prompt = localStorage.getItem("system-prompt");
const ollamaSystemPromptElement = document.getElementById("system-prompt");
ollamaSystemPromptElement.value = ollama_system_prompt || ""; // Handle potential null value

if (rebuildRules) rebuildRules(ollama_host);

function setHostAddress() {
  ollama_host = ollamaHostElement.value;
  localStorage.setItem("host-address", ollama_host);
  populateModels(); // Assuming this function exists
  if (rebuildRules) rebuildRules(ollama_host);
}

function setSystemPrompt() {
  ollama_system_prompt = ollamaSystemPromptElement.value;
  localStorage.setItem("system-prompt", ollama_system_prompt);
}

async function getModels() {
  const response = await fetch(`${ollama_host}/api/tags`);
  return await response.json();
}

function postRequest(data, signal) {
  // generate
  return fetch(`${ollama_host}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data),
    signal: signal
  });
}

async function getResponse(response, callback) {
  const reader = response.body.getReader();
  let partialLine = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const textChunk = new TextDecoder().decode(value);
    const lines = (partialLine + textChunk).split('\n');
    partialLine = lines.pop();
    for (const line of lines) {
      if (line.trim() === '') continue;
      try {
        callback(JSON.parse(line));
      } catch (error) {
        console.error("Error parsing JSON:", line, error);
      }
    }
  }
  if (partialLine.trim() !== '') {
    try {
      callback(JSON.parse(partialLine));
    } catch (error) {
      console.error("Error parsing last JSON chunk:", partialLine, error);
    }
  }
}
