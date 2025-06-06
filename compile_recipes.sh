#!/bin/bash

echo "Compiling perry_recipes.tex..."

# First pass
pdflatex perry_recipes.tex

# Second pass for table of contents
pdflatex perry_recipes.tex

# Clean up auxiliary files (optional)
rm -f perry_recipes.aux perry_recipes.log perry_recipes.toc

echo "Done! PDF updated: perry_recipes.pdf" 