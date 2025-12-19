---
topic: ink/getting-started
title: Install
description: "```sh"
version: 5.x
sourceUrl: https://github.com/vadimdemedes/ink
tags:
  - ink
  - getting-started
---

## Install

```sh
npm install ink react
```

## Usage

```jsx
import React, {useState, useEffect} from 'react';
import {render, Text} from 'ink';

const Counter = () => {
	const [counter, setCounter] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setCounter(previousCounter => previousCounter + 1);
		}, 100);

		return () => {
			clearInterval(timer);
		};
	}, []);

	return <Text color="green">{counter} tests passed</Text>;
};

render(<Counter />);
```

<img src="media/demo.svg" width="600">

Feel free to play around with the code and fork this Repl at [https://repl.it/@vadimdemedes/ink-counter-demo](https://repl.it/@vadimdemedes/ink-counter-demo).