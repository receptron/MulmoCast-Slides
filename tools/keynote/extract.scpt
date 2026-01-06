-- Keynote Slides to MulmoScript Exporter
-- This script exports each slide of a Keynote presentation as an image
-- then, generate a MulmoScript using speaker note of each slide as text.
-- Usage: yarn keynote [path/to/presentation.key]

on run argv
	-- Check if a file path was provided as argument
	if (count of argv) > 0 then
		-- Get the relative/absolute path from argument
		set inputPath to item 1 of argv

		-- Convert relative path to absolute path using shell
		set absolutePath to do shell script "cd \"$(dirname " & quoted form of inputPath & ")\"; echo \"$PWD/$(basename " & quoted form of inputPath & ")\""

		-- Convert POSIX path to file reference
		set keynoteFile to POSIX file absolutePath as alias
	else
		-- Ask user to select a Keynote file if no argument provided
		set keynoteFile to choose file with prompt "Select a Keynote file:" of type {"com.apple.iwork.keynote.sffkey", "com.apple.iwork.keynote.key"}
	end if

	-- Get the file path and extract folder/filename info
	set filePosixPath to POSIX path of keynoteFile

	-- Get current working directory
	set currentDirectory to do shell script "pwd"

	-- Create output folder paths in current directory
	set outputFolder to currentDirectory & "/output"
	set outputImagesFolder to outputFolder & "/images"
	set outputScriptFile to outputFolder & "/script.json"

	-- Create the output folders if they don't exist
	do shell script "mkdir -p " & quoted form of outputImagesFolder

	-- Remove all existing files from the images folder
	do shell script "rm -f " & quoted form of outputImagesFolder & "/*"

	-- Open and export from Keynote
	tell application "Keynote"
		activate
		
		-- Open the presentation
		open keynoteFile
		
		-- Wait for the document to open
		delay 1
		
		-- Get reference to the front document
		set theDocument to front document
		
		-- Get the number of slides
		set slideCount to count of slides of theDocument

		-- Collect speaker notes from all slides
		set allNotes to {}
		repeat with i from 1 to slideCount
			set currentSlide to slide i of theDocument
			set speakerNotes to presenter notes of currentSlide
			set end of allNotes to speakerNotes
		end repeat

		-- Export all slides as images to the output folder
		-- Keynote will create numbered image files automatically
		export theDocument to POSIX file outputImagesFolder as slide images with properties {image format:PNG, compression factor:1.0}

		-- Close the document without saving
		close theDocument saving no
	end tell

	-- Create JSON file with beats
	-- First, write notes to a temporary file
	set tempFile to outputFolder & "/.temp_notes.txt"
	set AppleScript's text item delimiters to (ASCII character 30) -- Use ASCII Record Separator as delimiter
	set notesText to allNotes as text
	set AppleScript's text item delimiters to ""
	do shell script "printf '%s' " & quoted form of notesText & " > " & quoted form of tempFile

	-- Then use Python to create JSON from the temp file
	do shell script "python3 << 'PYEOF'
import json
import os

# Read notes from temp file
with open('" & tempFile & "', 'r') as f:
    content = f.read()

# Split by ASCII Record Separator (character 30)
notes = content.split(chr(30)) if content else []

# Get absolute path to images folder
images_folder = '" & outputImagesFolder & "'

# Create beats array with image paths
beats = []
for i, note in enumerate(notes, start=1):
    image_filename = f'images.{i:03d}.png'
    image_path = os.path.join(images_folder, image_filename)
    beats.append({
        'text': note,
        'image': {
            'type': 'image',
            'source': {
                'kind': 'path',
                'path': image_path
            }
        }
    })

# Create MulmoScript object with metadata
mulmocast = {
    '$mulmocast': {
        'version': '1.1',
        'credit': 'closing'
    },
    'beats': beats
}

# Write JSON file
with open('" & outputScriptFile & "', 'w') as f:
    json.dump(mulmocast, f, indent=2, ensure_ascii=False)
PYEOF"

	-- Clean up temp file
	do shell script "rm -f " & quoted form of tempFile

	-- Clean up hidden characters from exported filenames
	-- Remove carriage returns and Left-to-Right Mark (U+200E) characters
	-- Issue: https://discussions.apple.com/thread/255014422?sortBy=rank
	do shell script "cd " & quoted form of outputImagesFolder & " && python3 << 'PYEOF'
import os
for filename in os.listdir('.'):
    if os.path.isfile(filename):
        new_name = filename.replace('\\u200e', '').replace('\\r', '')
        if filename != new_name:
            os.rename(filename, new_name)
PYEOF"

	-- Export completed silently

end run