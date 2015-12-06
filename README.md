# LeagueRankedScript
A Google Sheets add-on that automatically populates a spreadsheet with my League of Legends stats

# Introduction
I have always strived to get better at League of Legends, and one of the ways I attempted to do so was by tracking my statistics. Other attempts failed because there was simlpy too much information to write by hand, or not enough information was populated. With the help of Google Sheets and Riot's API, I was able to create an automated program to track my statistics.

# How It Works
My spreadsheet is setup with an onLoad trigger so whenever the spreadsheet is opened, it will automatically start updating. It will pull data using Riot's API and check for any games that have not been added to the spreadsheet. If it finds any games that have not been added, it will populate the data and insert it into the spreadsheet.

# Benefits of Google Sheets
I ultimately decided to do it in Google Sheets because of the benefits it offers, such as:
* Easy viewing of the data
* Easy changes to the data
* Ability to filter data to check for trends
* Pivot tables allow me to see trends at a glance

# My Spreadsheet
A viewable copy of my Spreadsheet can be found here:
https://docs.google.com/spreadsheets/d/140xuAZCQ2TAfkAeuNztlITrBnaO8KvF6Vh_Nfw8ePCs/edit?usp=sharing
