Your map edits, written by the map editor (XenoholdEditor.exe).
  <map>.json      one file per edited map (the editor rebuilds js/mapedits.js from these, and the game loads that)
  custom_*.json   your own maps (New map in the editor, or copied from the game's map maker): the whole map, and
                  they show up in the game's arena list
  _prefabs.json   saved groups of props, shared by every map
  backup/         the previous version each time a map is saved or reverted (the newest 20 per map)
To undo a map's edits, use Revert in the editor. Delete map removes one of your own maps.
