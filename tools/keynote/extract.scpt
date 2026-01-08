-- Keynote Slides to MulmoScript Exporter
-- This script exports each slide of a Keynote presentation as an image
-- then, generate a MulmoScript using speaker note of each slide as text.
-- Usage: yarn keynote [path/to/presentation.key] [-l lang]
-- Supported languages: en, ja, fr, de (default: en)
-- Can also set MULMO_LANG environment variable

on run argv
	-- Default language
	set scriptLang to "en"
	set inputPath to ""

	-- Parse arguments
	set i to 1
	repeat while i ≤ (count of argv)
		set currentArg to item i of argv
		if currentArg is "-l" or currentArg is "--lang" then
			if i + 1 ≤ (count of argv) then
				set scriptLang to item (i + 1) of argv
				set i to i + 2
			else
				set i to i + 1
			end if
		else if inputPath is "" then
			set inputPath to currentArg
			set i to i + 1
		else
			set i to i + 1
		end if
	end repeat

	-- Check environment variable if lang not set via CLI
	if scriptLang is "en" then
		try
			set envLang to do shell script "echo $MULMO_LANG"
			if envLang is not "" then
				set scriptLang to envLang
			end if
		end try
	end if

	-- Validate language
	if scriptLang is not in {"en", "ja", "fr", "de"} then
		display dialog "Invalid language: " & scriptLang & ". Using 'en' as default." buttons {"OK"} default button "OK"
		set scriptLang to "en"
	end if

	-- Check if a file path was provided
	if inputPath is not "" then

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

	-- Extract basename (filename without extension)
	set fileBasename to do shell script "basename " & quoted form of filePosixPath & " .key"

	-- Get current working directory
	set currentDirectory to do shell script "pwd"

	-- Create output folder paths in scripts/<basename>/ directory
	set outputFolder to currentDirectory & "/scripts/" & fileBasename
	set outputImagesFolder to outputFolder & "/images"
	set outputScriptFile to outputFolder & "/mulmo_script.json"

	-- Create the output folders if they don't exist
	do shell script "mkdir -p " & quoted form of outputImagesFolder

	-- Remove all existing PNG files from the images folder
	do shell script "rm -f " & quoted form of outputImagesFolder & "/*.png"

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

		-- Export all slides as images to the images folder
		-- Keynote will create numbered image files automatically
		export theDocument to POSIX file outputImagesFolder as slide images with properties {image format:PNG, compression factor:1.0}

		-- Close the document without saving
		close theDocument saving no
	end tell

	-- Clean up hidden characters from exported filenames and rename to match PPTX format
	-- Remove carriage returns and Left-to-Right Mark (U+200E) characters
	-- Also rename from images.001.png to <basename>-0.png format
	-- Issue: https://discussions.apple.com/thread/255014422?sortBy=rank
	do shell script "cd " & quoted form of outputImagesFolder & " && python3 << 'PYEOF'
import os
import re

basename = '" & fileBasename & "'

for filename in os.listdir('.'):
    if os.path.isfile(filename) and filename.endswith('.png'):
        # Clean hidden characters
        clean_name = filename.replace('\\u200e', '').replace('\\r', '')

        # Extract slide number from images.XXX.png format
        match = re.match(r'.*\\.([0-9]+)\\.png$', clean_name)
        if match:
            slide_num = int(match.group(1)) - 1  # Convert to 0-indexed
            new_name = f'{basename}-{slide_num}.png'
            if filename != new_name:
                os.rename(filename, new_name)
        elif filename != clean_name:
            os.rename(filename, clean_name)
PYEOF"

	-- Create JSON file with beats
	-- First, write notes to a temporary file
	set tempFile to outputFolder & "/.temp_notes.txt"
	set AppleScript's text item delimiters to (ASCII character 30) -- Use ASCII Record Separator as delimiter
	set notesText to allNotes as text
	set AppleScript's text item delimiters to ""
	do shell script "printf '%s' " & quoted form of notesText & " > " & quoted form of tempFile

	-- Then use Python to create JSON from the temp file with relative paths
	do shell script "python3 << 'PYEOF'
import json

basename = '" & fileBasename & "'

# Read notes from temp file
with open('" & tempFile & "', 'r') as f:
    content = f.read()

# Split by ASCII Record Separator (character 30)
notes = content.split(chr(30)) if content else []

# Create beats array with relative image paths (in images/ subdirectory)
beats = []
for i, note in enumerate(notes):
    image_filename = f'./images/{basename}-{i}.png'
    beats.append({
        'text': note,
        'image': {
            'type': 'image',
            'source': {
                'kind': 'path',
                'path': image_filename
            }
        }
    })

# Create MulmoScript object with metadata
mulmocast = {
    '$mulmocast': {
        'version': '1.1',
        'credit': 'closing'
    },
    'lang': '" & scriptLang & "',
    'beats': beats
}

# Write JSON file
with open('" & outputScriptFile & "', 'w') as f:
    json.dump(mulmocast, f, indent=2, ensure_ascii=False)
PYEOF"

	-- Clean up temp file
	do shell script "rm -f " & quoted form of tempFile

	-- Export completed silently

end run
