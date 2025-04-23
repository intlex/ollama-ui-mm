# ollama-ui

Just a multimodal HTML UI for Ollama

Forked from https://github.com/ollama-ui/ollama-ui

## New
* Full message history support: switch from /api/generate to /api/chat.
* Support for multimodal models.
* Support for inserting images from the device and directly from the clipboard.
* Automatic recognition and formatting of the clipboard content when inserted into the request input field.

## Usage

```
git clone https://github.com/intlex/ollama-ui-mm
cd ollama-ui
make

open http://localhost:8000 # in browser
```

![screenshot1](/screenshot1.png?raw=true)

![screenshot2](/screenshot2.png?raw=true)
