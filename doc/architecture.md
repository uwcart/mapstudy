# Modules

**Bolded items are high priority for implementation**
[Items in brackets are aspirational]

## M-section

This section includes the modules necessary to create the map, which is situated on the left side of the page at a desktop aspect ratio, or on top if mobile.

### M-library

- **Leaflet**
- [MapboxGL]
- [D3]

### M-isomorph

- **Choropleth**
- Dot
- **Proportional Symbol**
- Isoline
- Config
	- Size (radius)
	- Shape (circle, square, icon)
	- Fill color
	- Fill opacity
	- Line color
	- Line opacity

### M-interaction

- **Filter**
- **Zoom**
- Pan
- Retrieve
- Sequence
- Reexpress
- [Rotate (MapboxGL and D3 only)]
- [Resymbolize]
- [Reproject]
- [Overlay]

### M-parameters

- Geocenter
- Data layer
	- File URL -OR-
	- PostGIS table name (assumes database parameters in P-section)
	- Available attributes
	- Expressed attribute
	- Leaflet and Mapbox layer options
- Base tile layer (Leaflet and MapboxGL only)
	- Leaflet and Mapbox layer options
- [Alternative tile layers
	- options]
- [Data overlays
	- Selected attributes
	- options]

## Q-section

This section includes the survey question modules in a nested heirarchy. A Q-set module is a set of child modules displayed on the page at once. Q-sets are displayed in the order in which they are declared. A Q-block is a question block that contains the question and/or Q-inputs for the answer(s). A Q-input is one input element and any associated prompt or label belonging to a Q-block. A Q-button is on the same level as a Q-block and contains a Back, Next, or Submit button.

### Q-set

Wrapper for all Q-blocks on a page

Requirements:
-1+ Q-blocks
-Next or Submit Q-button

### Q-block

Question block

Dependency: Q-set

- Reset numbering? (boolean)
- Question title
- Question ask
- Question description

### Q-input

Input element for a question answer

Dependency: Q-block

- Type
	- Text
	- Paragraph
	- Radio
	- Checkbox
	- Dropdown
	- Matrix
		- Options
		- Items
- Starting value or prompt
- Label (for Radio or Checkbox)

### Q-button

Navigation button

Dependency: Q-set

- Type
	- Back
	- Next
	- Submit

## P-section

This section includes back-end parameters that are custom to the survey. To hide it from users, it is included in a PHP file rather than a JS file.

- Database
	- Server IP address
	- Username
	- Password

## Includes

Non-customizable script modules

- Interaction logging script
- SQL for building the necessary Postgresql tables