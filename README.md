# LeagueRankedScript
A Google Sheets add-on that automatically populates a spreadsheet with my League of Legends stats. The script is written in JavaScript and makes use of Riot and Google's APIs.

# Introduction
I have always strived to get better at League of Legends, and one of the ways I attempted to do so was by tracking my statistics. Other attempts failed because there was simlpy too much information to write by hand, or not enough information was populated. With the help of Google Sheets and Riot's API, I was able to create an automated program to track my statistics.

# How It Works/How To Use
Simply select Run from the Ranked menu option and the script will start running. It will pull data using Riot's API and check for any games that have not been added to the spreadsheet. If it finds any games that have not been added, it will populate the data and insert it into the spreadsheet. There is no need to do anything other than that, everything will get tracked.

If there are any problems with the data, you can correct a single row. In the configuration sheet, insert a value into the correct_row field and then select the option Ranked-> Correct Row, and it will repopulate the data for that row.

# Benefits of Google Sheets
I ultimately decided to do it in Google Sheets because of the benefits it offers, such as:
* Easy viewing and storage of the data
* Easy changes to the data
* Ability to filter data to check for trends
* Pivot tables allow me to see trends at a glance

# How to Setup
1. Go to https://docs.google.com/spreadsheets/d/1WoQA9mYR7mir8W_ezfbhdxO9oUIVD5zl42rKd5j3VP4/edit?usp=sharing and make a copy of the spreadsheet. This is a template spreadsheet for others to use.
2. Click on Tools-> Script Editor, a new tab will open up. Paste the code in there and save it. You can call it whatever you like.
![alt tag](http://i.imgur.com/s4Rzz1A.png)
![alt tag](http://i.imgur.com/fatevSM.png)
3. Re-open the spreadsheet. You should now see a new tab Ranked at the top. If you do, you've added the code correctly. If not, see step 2 again.
![alt tag](http://i.imgur.com/L8Wq72a.png)
4. Click on the configuration tab at the bottom, you need to configure a few items first:
* Set the region to whatever your region is. A list of them is provided as a note on the spreadsheet. Note that I have only tested this for the NA region, it may not work properly for other regions.
* Set the summoner_name to whatever your summoner name is.
* Set the API key to whatever your API key is. If you do not have one, you can get one at developer.riotgames.com. Remember that you need to keep this private, please do not share this with anyone under any circumstances.
![alt tag](http://i.imgur.com/Rd28SSS.png)
5. Click Ranked-> Run Initial. The spreadsheet will begin to populate data. 
You may receive a notification about authorizing the application. You will not be able to proceed until you accept it. None of your personal information is stored in this application.
![alt tag](https://developers.google.com/apps-script/images/new-auth-2.png)
6. On the initial run, it may not complete all the data. This is because there is a maximum time of 5 minutes for the script. If it does not complete, just run it again and it will continue from where it left off. **You will likely need to run it several times to populate all the data.** Please select Run Initial as the option while populating it from scratch. Later on, you will want to select Run. The Run Initial option is optimized to save time by not populating league/tier/division/LP/promo information.

# My Spreadsheet
A viewable copy of my Spreadsheet can be found here:
https://docs.google.com/spreadsheets/d/140xuAZCQ2TAfkAeuNztlITrBnaO8KvF6Vh_Nfw8ePCs/edit?usp=sharing

# Known Issues
Unfortunately, there are some issues with the spreadsheet. Fortunately, they are all minor things and can be corrected easily.
**NOTE THAT THIS ONLY WORKS FOR RANKED SOLO QUEUE**

1. Sometimes the role for you or another champion will come up wrong. This is because Riot calculates the role incorrectly. Riot calculates it using gold income and which area of the map you are on. If you spend too long out of lane or too long in a different lane, your role can get calculated incorrectly. My code uses some additional metrics to fix this, but it can still come up wrong. If you notice it's wrong, you can correct it manually quite easily.
2. When roles get calculated incorrectly, sometimes the delta stats get lost. Unfortunately, I can't help you there, it's Riot's responsibility to populate the delta stats, and they don't.
3. LP changes sometimes take a few minute for Riot's servers to update. If you update too quickly after your game, it may not populate it correctly. This includes tracking if you're in promos or not. On the other hand, if you're not updating it regularly, the LP/Promo stats won't get tracked correctly, because it will only see your current one. The code can only update it with what your current information has, so if you update it after several games, it won't track the changes after each individual game.
4. You have to manually track a duo the first time you duo. After that, the sheet is capable of tracking it automatically if you wish to do so. It may track incorrectly for a small percentage of players who duo with many people and play with those people while not duoing as well. This is likely only a problem for Master/Challenger ranked players.
5. Delta stats for time intervals don't get populated unless the entire time fram is encapsulated. For example, in a 28 minute game, you won't get a 20-30 delta populated. For 30-End, it usually gets populated at around 35+ minutes.
6. AFKs are automatically tracked, but it can't be done accurately. This is because the way we have to check, we can't guarantee it. As a result, if you notice anything wrong, you can fix it yourself, it's easy to do.
7. The percentage tracking on the additional spreadsheets rely on a specific cell being the grand total. If it's not tracking correctly, it's because the grand total cell is wrong. Fix it by changing it in the formula to the correct one.
8. I have not tested it for regions other than NA. If it does not work, sorry about that. Let me know and I'll see what I can do.
9. If you have changed your summoner name, it will fail on games that used your old name. You will need to run it with the old name for those set of games. You will also want to run it with the Run Initial option, because we need to skip checking your league information. It will try to search for your stats, but it won't find your old summoner name, so we'll want to skip it altogether to save time.

# Copyright
LeagueRankedScript isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.
