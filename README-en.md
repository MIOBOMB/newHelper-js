# newHelper.js
- [русская версия](README.md)
- A library for creating ultra-lightweight yet highly functional admin panels, one of the best examples of Object Hub. The total bundle of the entire site is only 280 kb of pure code, and the internal admin panel with all HTML+CSS+JS weighs only 25 kilobytes (with gzip, the size is even smaller). I try to keep the library in a "Modular Monolith" state.
Current version - 2.1, with good documentation in the code
## Included modules:
- Advanced window engine (resize, fullscreen, taskbar, 6.29 KB)
- Convenient hotkeys (press/release callbacks, 1.16 KB)
- Router (1.48 KB)
- Ultra-light i18n analog (1.30 KB)
- Custom lazy-load (0.97 KB)
- Error catching module (0.54 KB)
- Simple HTTP client with file upload progress (0.82 KB)
- DOM helpers (0.61 KB)
- Storage isolation (0.31 KB)

## Features
- The library uses a classic connection with a script tag and requires no bundlers/compilers. But if you really want to, you can configure it, but why? It's the assembly language of the web world.
- Dependencies? Nope, it's vanilla ES6.
- The library size mentioned at the beginning is the size of the source code, so minification + gzip will reduce the size even further.
- Due to the minimalistic code, you can freely override any built-in method to suit your needs. In extreme cases, you can resort to modifying the library's code, but we don't recommend this if you plan to update to the latest versions.
- All the code is written inside a single "_" and uses only three global event listeners. Because of this, conflicts with other libraries are minimal. If you're willing, you can try running newHelper alongside jQuery, or if you really want reactivity, try it in combination with ultra-light reactive frameworks (the only decent one I know of is alpine.js).
- If you're a follower of "14-kilobyte sites," you can safely run the library through a minifier. The minified code of the library shouldn't weigh more than 5 kilobytes, and if you discard modules you don't need, even less (for example, the window engine code makes up approximately 50% of the entire library code; if you don't need the window engine, you're left with a 2-kilobyte gzip core).
- If you learn to use lazy loading properly, your already lightweight sites will become many times lighter (for instance, the initial traffic of Object Hub decreased from 330kb to 180kb at startup due to splitting everything into lazyload modules).
- A couple of my sites not related to admin panels are based on this library - GDPS Helper (a catalog of private Geometry Dash servers, but it also has an admin panel for demon lists), Object Hub (a wiki-engine-like catalog and HR platform for the OSC community; the wiki engine heavily uses windows instead of MediaWiki crutches). If you want, you can not only assemble an admin panel in 2 hours but also write a mega-site in a couple of weeks.
- The library was born 3 years ago as an internal tool for the GDPS Helper website. It evolved due to my disdain for the heaviness of React. Later, the GDPS Helper source code became the foundation for Object Hub, during the development of which the window engine, hotkeys, and more powerful lazy loading appeared.
- As a developer, I try to follow the Unix philosophy. For example, simplicity over complexity - there are only 600 lines of code. Or modularity - even though my modules are slightly interconnected, each module is responsible for its own thing.
- Continuing the previous point, you can use newHelper.js anywhere and everywhere. Its application is limited only by your imagination. Want to make a cool admin panel? The library is aimed at that. Want to write a full-fledged web forum? If you still remember GDPS Helper or Object Hub, it's entirely possible. Want to write your own frontend for the Yandex API? If you have a lot of time, please go ahead.
