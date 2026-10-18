# solar-models

Array shading and output renders for a ground-mounted bifacial PV layout. Open `array_shading_render.html` in a browser; there is nothing to install.

## What it shows

- An original and an alternative layout on a plan grid. The origin 0,0 is the south-west corner; right is east and up is north.
- Sun and shade for any time of day and day of year, with a clock slider and a day slider.
- Clear-sky output for the day, for each month, and for the year, for both layouts. Output includes the rear face and ground reflection.
- Scenario files (`.js`) that hold the location, the site inputs, the rows, and the summary results.

The defaults are a sketch at 38.8 N, 121.2 W. Change the location and the rows for another site.

## Location and time zone

Latitude and longitude set the sun path. Changing either one looks up the time zone; the "Look up time zone" button does the same. The lookup sends only those two numbers to open-meteo.com. Offline, choose the zone from the list. The zone sets the clock labels, including daylight time. It does not change the energy.

## Scenario files

Saving writes `<name>.js`, which contains `var ARRAY_SCENARIO = {...}`. Loading reads a file back, or paste its text into the box. Files from versions 1 to 5 still load. The current format is version 6.

## Assumptions

- Graph north (the sketch's up) is true north unless the true north offset is set under Location.
- Clear-sky irradiance. Ground albedo (0.40) and the system factor (0.85) are placeholders to set for the site.
- Shading comes from the modules and one east wall only. Trees, buildings, and neighbours are not modelled.
- Monthly and yearly totals use the 15th of each month, scaled by the days in the month.

## Tests

```
npm test
```

`test/shade_rows_check.js` checks the geometry, the energy, and the location handling. `test/shade_smoke2.js` runs the page against a stub DOM: the sliders, the rows, the time zone lookup (with a stubbed fetch), and scenario load and save. Both need Node.js only.
