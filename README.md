# ollama-ui-mm

Just a multimodal HTML UI for Ollama

Forked from https://github.com/ollama-ui/ollama-ui

## New
* Full message history support: switch from /api/generate to /api/chat.
* Support for multimodal models.
* Support for inserting images from the device and directly from the clipboard.
* Automatic recognition and formatting of the clipboard content when inserted into the request input field.
* The code is slightly optimized and cleaned.

## Notice

Сhanged to using local resources, but katex@0.16.8 not included - https://github.com/ollama-ui/ollama-ui/pull/17/commits/39f63058983b80d23ad6732f98f0b320497dd774

## Usage

```
git clone https://github.com/intlex/ollama-ui-mm
cd ollama-ui
make

open http://localhost:8000 # in browser
```

![screenshot1](/screenshot1.png?raw=true)

![screenshot2](/screenshot2.png?raw=true)
