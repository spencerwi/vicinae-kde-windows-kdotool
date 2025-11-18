# KDE Wayland Windows Vicinae Extension

On KDE Wayland, Vicinae doesn't support searching/raising windows out of the box. This patches over that a bit.

## Requirements

You have to have [kdotool](https://github.com/jinliu/kdotool) installed on your system for this to work.

## Developing 

You can install the required node dependencies (not kdotool though) and run this extension in development mode like so:

```bash
npm install
npm run dev
```
If you want to build the production bundle, simply run:

```bash
npm run build
```
