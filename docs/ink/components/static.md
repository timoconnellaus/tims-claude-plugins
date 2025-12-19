---
topic: ink/components/static
title: Static Component
description: "`<Static>` component permanently renders its output above everything else."
version: 5.x
sourceUrl: https://github.com/vadimdemedes/ink
tags:
  - ink
  - components
---

### `<Static>`

`<Static>` component permanently renders its output above everything else.
It's useful for displaying activity like completed tasks or logs - things that
don't change after they're rendered (hence the name "Static").

It's preferred to use `<Static>` for use cases like these when you can't know
or control the number of items that need to be rendered.

For example, [Tap](https://github.com/tapjs/node-tap) uses `<Static>` to display
a list of completed tests. [Gatsby](https://github.com/gatsbyjs/gatsby) uses it
to display a list of generated pages while still displaying a live progress bar.

```jsx
import React, {useState, useEffect} from 'react';
import {render, Static, Box, Text} from 'ink';

const Example = () => {
	const [tests, setTests] = useState([]);

	useEffect(() => {
		let completedTests = 0;
		let timer;

		const run = () => {
			// Fake 10 completed tests
			if (completedTests++ < 10) {
				setTests(previousTests => [
					...previousTests,
					{
						id: previousTests.length,
						title: `Test #${previousTests.length + 1}`
					}
				]);

				timer = setTimeout(run, 100);
			}
		};

		run();

		return () => {
			clearTimeout(timer);
		};
	}, []);

	return (
		<>
			{/* This part will be rendered once to the terminal */}
			<Static items={tests}>
				{test => (
					<Box key={test.id}>
						<Text color="green">✔ {test.title}</Text>
					</Box>
				)}
			</Static>

			{/* This part keeps updating as state changes */}
			<Box marginTop={1}>
				<Text dimColor>Completed tests: {tests.length}</Text>
			</Box>
		</>
	);
};

render(<Example />);
```

**Note:** `<Static>` only renders new items in the `items` prop and ignores items
that were previously rendered. This means that when you add new items to the `items`
array, changes you make to previous items will not trigger a rerender.

See [examples/static](examples/static/static.tsx) for an example usage of `<Static>` component.