/*
 * Gets an array of all games we haven't recorded and then populates the data for it on our sheet
 * onOpen is the function called when the sheet is loaded
 */
function onOpen() {
  var match_history = findUniqueMatchIds();
  if(!match_history || match_history == 'exit') {
    return 'exit';
  }
  var result = populate(match_history);
  if(result == 'exit') {
    // TODO: check if we need to delete a partial entry
  }
}

/**
 * Get our information from the info sheet
 * The only fields applicable are the api key, region, summoner name, season, summoner id, and check duoer
 */
function getInfo(value) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Info');
  if(value == 'api_key') {
    return sheet.getRange('B1').getValue();
  }
  if(value == 'region') {
    return sheet.getRange('B2').getValue();
  }
  if(value == 'summoner_name') {
    return sheet.getRange('B3').getValue();
  }
  if(value == 'season') {
    return sheet.getRange('B5').getValue();
  }
  if(value == 'check_duoer') {
    return sheet.getRange('B6').getValue();
  }
  // summoner_id has a special case because it's populated the first time we run the script
  if(value == 'summoner_id') {
    val = sheet.getRange('B4').getValue();
    if(!val) {
      val = getSummonerId();
      if(val == 'exit') {
        return 'exit';
      }
    }
    sheet.getRange('B4').setValue(val);
    return val;
  }
}

/**
 * Find the match ids from our match history that we haven't added to the sheet yet
 * Returns them as an array in chronological order
 */
function findUniqueMatchIds() {
  match_history = getMatchHistoryIds();
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var values = s.getDataRange().getValues();
  for(i = values.length - 1; i > 0; i--) {
    if(match_history.indexOf(values[i][0]) != -1) {
      // once we find a match in the match history that matches something in our spreadsheet
      // we discard all games after since it's in chronological order
      // and just take any games that are newer
      return match_history.slice(0, match_history.indexOf(values[i][0])).reverse();
    }
  }
  // match history is always sent in reverse because riot populates in reverse chronological order
  // but we want to append in chronological order
  return match_history.reverse();
}

/**
 * For a given set of match ids, populate the spreadsheet data
 */
function populate(match_history) {
  // call all the necessary functions to update the spreadsheet
  // some functions will update the values themselves
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  for(n = 0; n < match_history.length; n++) {
    sheet.appendRow([match_history[n]]);
    var row = getFirstEmptyRow() - 1;
    var match = getMatch(match_history[n]);
    if(match == 'exit') {
      return 'exit';
    }
    var dt = getMatchDate(match);
    setCell('Date', row, dt[0]);
    setCell('Time', row, dt[1]);
    setCell('Length', row, getMatchLength(match));
    var pid = getMatchParticipantId(match);
    var pobj = getParticipantObj(match, pid);
    var teamId = getMatchTeamId(pobj);
    var myChamp = getMyChampion(pobj);
    if(myChamp == 'exit') {
      return 'exit';
    }
    setCell('My Champion', row, myChamp);
    var side = (pid <= 5? 'Blue' : 'Red'); // pid 1-5 is blue side, 6-10 is red side
    setCell('Side', row, side);
    setCell('Result', row, getMatchResult(pobj));
    var stats = getPlayerStats(pobj);
    setCell('Kills', row, stats['kills']);
    setCell('Deaths', row, stats['deaths']);
    setCell('Assists', row, stats['assists']);
    setCell('My KDA', row, stats['kda']);
    var cs = getMyCS(pobj, getMatchLength(match));
    setCell('CS', row, cs[0]);
    setCell('CS/Min', row, cs[1]);
    getAndSetChampionStats(match, getMatchTeamId(pobj), row);
    setCell('My Role', row, getMyRole(row));
    setCell('Kill Contribution', row, (stats['kills'] + stats['deaths'])/getTotalKills(match, teamId));
    setCell('Death Contribution', row, stats['deaths']/getTotalDeaths(match, teamId));
    setCell('Highest KDA', row, getHighestKDA(row));
    leagueStats = getMyLeagueStats(); 
    if(leagueStats == 'exit') {
      return 'exit';
    }
    setCell('League', row, leagueStats['tier']);
    setCell('Division', row, leagueStats['division']);
    setCell('Current LP', row, leagueStats['lp']);
    var oldLP = sheet.getRange(row-1, getSheetTranslationIndex('Current LP')).getValue();
    getAndSetPromosLP(oldLP, leagueStats['lp'], sheet.getRange(row-1, getSheetTranslationIndex('Promos')).getValue(), leagueStats['promos'], row);
    // because searching through n rows is potentially computationally expensive, give the user the option to disable to save time
    if(getInfo('check_duoer')) {
      setDuoer(match, row, getTeamPlayers(match, teamId));
    }
    var bans = getBans(match);
    setCell('Ban 1', row, bans[0]);
    setCell('Ban 2', row, bans[1]);
    setCell('Ban 3', row, bans[2]);
    setCell('Ban 4', row, bans[3]);
    setCell('Ban 5', row, bans[4]);
    setCell('Ban 6', row, bans[5]);
    var neutral = getDragonsBarons(match, teamId);
    setCell('My Dragons', row, neutral['myDragons']);
    setCell('Enemy Dragons', row, neutral['enemyDragons']);
    setCell('My Barons', row, neutral['myBarons']);
    setCell('Enemy Barons', row, neutral['enemyBarons']);
    var firstStats = getFirstStats(match, teamId);
    setCell('First Blood', row, firstStats['firstBlood']);
    setCell('First Tower', row, firstStats['firstTower']);
    setCell('First Inhibitor', row, firstStats['firstInhibitor']);
    setCell('First Dragon', row, firstStats['firstDragon']);
    setCell('First Baron', row, firstStats['firstBaron']);
    var damageToChamps = getChampionDamageDealt(pobj)/getTotalTeamDamage(match, teamId);
    setCell('Damage to Champions', row, damageToChamps);
    var wardStats = getWardStats(pobj); // wards placed, destroyed, vision bought
    setCell('Wards Placed', row, wardStats[0]);
    setCell('Wards Destroyed', row, wardStats[1]);
    setCell('Vision Wards Bought', row, wardStats[2]);
    getDeltas(pobj, row);
    var oppPobj = getOpponentParticipantObj(match, getRoleFromParticipantObj(pobj), teamId);
    var laneOpponentStats = getLaneOpponentStats(match, oppPobj, getOpponentTeamId(teamId));
    setCell('Total CS Difference', row, cs[0]-laneOpponentStats['minions']);
    setCell('Kill Diff', row, stats['kills']-laneOpponentStats['kills']);
    setCell('Death Diff', row, stats['deaths']-laneOpponentStats['deaths']);
    setCell('Assist Diff', row, stats['assists']-laneOpponentStats['assists']);
    setCell('KDA Diff', row, stats['kda']-laneOpponentStats['kda']);
    setCell('Damage to Champions Diff', row, damageToChamps-laneOpponentStats['damageToChamps']);
    setCell('Wards Placed Diff', row, wardStats[0]-laneOpponentStats['wardsPlaced']);
    setCell('Wards Destroyed Diff', row, wardStats[1]-laneOpponentStats['wardsDestroyed']);
    setCell('Vision Wards Bought Diff', row, wardStats[2]-laneOpponentStats['visionWardsBought']);
    setCell('Kill Contribution Diff', row, (stats['kills'] + stats['assists'])/getTotalKills(match, teamId)-laneOpponentStats['killContributionPercentage']);   
  }
}

/**
 * Get the first empty row in the sheet
 */
function getFirstEmptyRow() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var column = sheet.getRange('A:A');
  var values = column.getValues();
  var count = 0;
  while(values[count] && values[count][0] != '') {
    count++;
  }
  return (count+1);
}

/**
 * Get the cell letter for a specific column header
 */
function getSheetTranslation(header) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var data = sheet.getDataRange().getValues();
  for(j = 0; j < data[0].length; j++) {
    if(data[0][j] == header) {
      return columnToLetter(j+1);
    }
  }
}

/**
 * Get the cell index for a specific column header
 */
function getSheetTranslationIndex(header) {  
  // this function exists because when reading a cell, we need the index values rather than letter
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var data = sheet.getDataRange().getValues();
  for(j = 0; j < data[0].length; j++) {
    if(data[0][j] == header) {
      return j+1;
    }
  }
}

/**
 * Translate the column number into the letter
 */
function columnToLetter(column) {
  var temp, letter = '';
  while(column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/**
 * Set the cell at column, row, to a specific value
 * Column is the header name, not the letter or index value
 */
function setCell(column, row, value) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  sheet.getRange(getSheetTranslation(column)+row).setValue(value);
}

/**
 * Get the summoner id by name
 */
function getSummonerId() {
  var url = 'https://' + getInfo('region') + '.api.pvp.net/api/lol/' + getInfo('region') + '/v1.4' + '/summoner/by-name/' + getInfo('summoner_name') + '?api_key=' + getInfo('api_key');
  var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);  
    return data[getInfo('summoner_name')]['id'];
  }
  else if(status == 'exit') {
    return 'exit';
  }
  else if(status) { //wait 10 seconds
    Utilities.sleep(10000);
    return getSummonerId();
  }
}

/**
 * Get the game ids for our recent matches
 * Note that this returns only ranked solo queue 5x5 games as per the current implementation
 * Returns an array of all the matchIds
 */
function getMatchHistoryIds(mode, season) {
  // we get match ids because the match history only has our information
  // and since we want to track other player kdas then we're going to need the full match info per match
  // NOTE: season is going to have to be changed each season
  mode = typeof mode !== 'undefined' ? mode : '?rankedQueues=RANKED_SOLO_5x5';
  season = typeof season !== 'undefined' ? mode : '&seasons=' + getInfo('season');
  var url = 'https://' + getInfo('region') + '.api.pvp.net/api/lol/' + getInfo('region') + '/v2.2' + '/matchlist/by-summoner/' + getInfo('summoner_id') + mode + season + '&api_key=' + getInfo('api_key'); 
  var response = UrlFetchApp.fetch(url);
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);
    var s = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = s.getSheetByName('Data');
    var matchIds = [];
    for(i = 0; i < data["matches"].length; i++) {
      if(data["matches"][i]["matchId"] != "undefined") {
        matchIds.push(data["matches"][i]["matchId"]);
      }
    }
    return matchIds;
  }
  else if(status == 'exit') {
    return 'exit';
  }
  else if(status) { //wait 10 seconds
    Utilities.sleep(10000);
    return getMatchHistoryIds(mode);
  }
}

/**
 * Get the match details from a given matchId
 * Returns the json object of the match
 */
function getMatch(matchId) {
  var url = 'https://' + getInfo('region') + '.api.pvp.net/api/lol/' + getInfo('region') + '/v2.2' + '/match/' + matchId + '?api_key=' + getInfo('api_key');
  var response = UrlFetchApp.fetch(url);
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);
    return data;
  }
  else if(status == 'exit') {
    return 'exit';
  }
  else if(status) { //wait 10 seconds
    Utilities.sleep(10000);
    return getMatch(matchId);
  }
}

/**
 * Get the date of a game
 * Returns an array with the date and time in that order
 */
function getMatchDate(match) {

  var utcSeconds = match['matchCreation'];
  var d = new Date(utcSeconds); 
  var date = d.toDateString();
  var time = d.toLocaleTimeString();
  var h, ampm;
  if(time.indexOf(':') == 1) {
    h = time.substring(0,1);
  }
  else {
    h = time.substring(0,2);
  }
  var ampm = time.substring(time.length - 6, time.length - 4);
  return [date, (h + ' ' + ampm)];
}

/**
 * Get the duration of a match
 */
function getMatchLength(match) {
  return Math.round(match['matchDuration']/60);
}

/**
 * Get our participant id
 * pid tells us which stuff to look at for our role, stats, etc
 */
function getMatchParticipantId(match) {
  var participants = match['participantIdentities'];
  for(i = 0; i < participants.length; i++) {
    if(participants[i]['player']['summonerName'] == getInfo('summoner_name')) {
      return participants[i]['participantId'];
    }
  }
}

/**
 * Get the participant object for ourselves
 * This function exists for simplicity of getting this object that we will need several times
 */
function getParticipantObj(match, pid) {
  var participants = match['participants'];
  for(i = 0; i < participants.length; i++) {
    if(participants[i]['participantId'] == pid) {
      return participants[i];
    }
  }
}

/**
 * Get the participant object for our lane opponent
 */
function getOpponentParticipantObj(match, role, teamId) {
  var participants = match['participants'];
  for(i = 0; i < participants.length; i++) {
    if(participants[i]['teamId'] != teamId) {
      if(getRoleFromParticipantObj(participants[i]) == role) {
        return participants[i];
      }
    }
  }
}

/**
 * Get the participant object given their summoner name
 */
function getParticipantObjByName(match, name) {
  var participants = match['participants'];
  var pids = match['participantIdentities'];
  var pid = -1;
  for(i = 0; i < pids.length; i++) {
    if(pids[i]['player']['summonerName'] == name) {
      pid = pids[i]['participantId'];
      break;
    }
  }
  return participants[pid-1];
}

/**
 * Get the id of the team from their participant object
 */
function getMatchTeamId(participant) {
  return participant['teamId'];
}

/**
 * Get the opposing team's id, returned as an int
 * Takes in our teamId as an argument
 */
function getOpponentTeamId(myTeamId) {
  if(myTeamId == 100) {
    return 200;
  }
  else {
    return 100;
  }
}

/*
 * Get the role for the champion I was playing
 * Takes the row of the current game being inserted
 */
function getMyRole(row) {
  // since determining our role from the participant object might fail if we're playing a duo role and it doesn't flag correctly
  // we would like to figure out our role after we fix the flagging to avoid going through the fix twice
  // so to do that, we calculate this after inserting all the champions and find our champion in the row
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var myChampion = sheet.getRange(row, getSheetTranslationIndex('My Champion')).getValue();
  if(myChampion == sheet.getRange(row, getSheetTranslationIndex('My Top')).getValue()) {
    return 'Top';
  }
  else if(myChampion == sheet.getRange(row, getSheetTranslationIndex('My Jungle')).getValue()) {
    return 'Jungle';
  }
  else if(myChampion == sheet.getRange(row, getSheetTranslationIndex('My Mid')).getValue()) {
    return 'Mid';
  }
  else if(myChampion == sheet.getRange(row, getSheetTranslationIndex('My ADC')).getValue()) {
    return 'ADC';
  }
  else {
    return 'Support';
  }
}

/**
 * Get the role from a participant object
 * Note: every champion gets assigned a role, even if they're all the same
 */
function getRoleFromParticipantObj(participant) {
  var role = participant['timeline']['role'];
  var lane = participant['timeline']['lane'];
  if(lane == 'TOP') {
    return 'Top';
  }
  else if(lane == 'JUNGLE') {
    return 'Jungle';
  }
  else if(lane == 'MIDDLE') {
    return 'Mid';
  }
  else if(lane == 'BOTTOM') {
    if(role == 'DUO_CARRY') {
      return 'ADC';
    }
    else if(role == 'DUO_SUPPORT') {
      return 'Support';
    }
    else { // if adc and support didn't properly get flagged, we will handle this case specifically
      return 'Unknown';
    }
  }
}

function getMyChampion(participant) {
  return getChampionTranslation(participant['championId']);
}

/**
 * Get champions and their kda
 * teamId is our teamId so we can tell which champs are which team
 */
function getAndSetChampionStats(match, teamId, row) {
  var participants = match['participants'];
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var botLanes = {"myBot" : [
    {'champion': '', 'cs': '', 'kda': ''},
    {'champion': '', 'cs': '', 'kda': ''} ],
                  "theirBot": [
    {'champion': '', 'cs': '', 'kda': ''},
    {'champion': '', 'cs': '', 'kda': ''} ]};
                    
  for(i = 0; i < participants.length; i++) {
    var botIssue = false; // used to track if there was an issue determining the duo role
    var lookupStr = '';
    if(participants[i]['teamId'] == teamId) {
       lookupStr += 'My ';
    }
    else {
      lookupStr += 'Their ';
    }
    var role = getRoleFromParticipantObj(participants[i]);
    if(role != 'Unknown') {
      lookupStr += role;
    }
    // if there's some irregularity with determining the bot lane, we'll default to this special method of determining
    // this special method will use CS to determine which person was ADC and which was Support
    // NOTE: this will evidently fail if someone AFKs, but then I can't really automate that without preassigning champion to role which would also fail
    // NOTE: if there's a problem with one duo role not getting flagged correctly, both will flag incorrectly
    else {
       var deaths = participants[i]['stats']['deaths'];
       deaths = (deaths == 0 ? 1 : deaths);
       var kda = (participants[i]['stats']['kills'] + participants[i]['stats']['assists']) / deaths;
       var botTeam = (participants[i]['teamId'] == teamId) ? 'myBot' : 'theirBot';
       var botIndex = botLanes[botTeam][0]['champion'] ? 1 : 0; // if the first index is already filled, then this pass through will set the second
       botLanes[botTeam][botIndex]['champion'] = getChampionTranslation(participants[i]['championId']);
       botLanes[botTeam][botIndex]['cs'] = participants[i]['stats']['minionsKilled'];
       botLanes[botTeam][botIndex]['kda'] = kda;
       botIssue = true;
    }
    var champ = getChampionTranslation(participants[i]['championId']);
    if(champ == 'exit') {
      return 'exit';
    }
    if(!botIssue) { // if there's no issues then just set it normally
      setCell(lookupStr, row, champ);
      lookupStr += ' KDA';
      var deaths = participants[i]['stats']['deaths'];
      deaths = (deaths == 0 ? 1 : deaths);
      var kda = (participants[i]['stats']['kills'] + participants[i]['stats']['assists']) / deaths;
      setCell(lookupStr, row, kda);
    }
    if(botLanes['myBot'][0]['champion'] || botLanes['myBot'][1]['champion']) { // now we fix it if we need to
      fixDuoRoles(botLanes['myBot'], 'My', row);
    }
    if(botLanes['theirBot'][0]['champion'] || botLanes['theirBot'][1]['champion']) {
      fixDuoRoles(botLanes['theirBot'], 'Their', row);
    }
  }
}

/*
 * Helper function to fix the duo roles
 * If the duo roles get mixed up for some reason because they didn't get flagged correctly
 * Then we fix them
 * data is the json object with all the data, botLaneTeam
 * prefix is the string prefix for the column header (either My or Their)
 * row is the row in the spreadsheet to insert the data
 */
function fixDuoRoles(data, prefix, row) {
  // check which of the two indexes has the higher cs value
  // that one gets labeled adc, other one gets labeled support
  var adcIndex = (data[0]['cs'] >= data[1]['cs']) ? 0 : 1;
  var supportIndex = (data[0]['cs'] < data[1]['cs']) ? 0 : 1;
  setCell(prefix.concat(' ADC'), row, data[adcIndex]['champion']);
  setCell(prefix.concat(' ADC KDA'), row, data[adcIndex]['kda']);
  setCell(prefix.concat(' Support'), row, data[supportIndex]['champion']);
  setCell(prefix.concat(' Support KDA'), row, data[supportIndex]['kda']);
}

/**
 * Get the name of a champion from its id
 */
function getChampionTranslation(championId) {
  var url = 'https://global.api.pvp.net/api/lol/static-data/na/v1.2/champion/' + championId + '?api_key=' + getInfo('api_key');
  var response = UrlFetchApp.fetch(url);
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);
    return data['name'];
  }
  else if(status == 'exit') {
    return 'exit';
  }
  else if(status) { //wait 10 seconds
    Utilities.sleep(10000);
    return getChampionTranslation(championId);
  }
}

/**
 * Get the result of a match
 * Returns the string 'Win' or 'Lose' accordingly
 */
function getMatchResult(pobj) {
  return (pobj['stats']['winner'] ? 'Win' : 'Lose');
}

/**
 * Returns an array with the stats for a given player denoted by their pobj
 * In the order: kills, deaths, assists, kda
 */
function getPlayerStats(pobj) {
  var stats = {kills : pobj['stats']['kills'],
               deaths : pobj['stats']['deaths'],
               assists : pobj['stats']['assists'],
               minions : pobj['stats']['minionsKilled'] + pobj['stats']['neutralMinionsKilled']}; 
  stats['kda'] = (stats['deaths'] == 0 ? (stats['kills'] + stats['assists']) : (stats['kills'] + stats['assists']) / stats['deaths']);
  return stats;
}

/**
 * Gets my cs stats for the game
 * Returns an array with the cs info
 * In the order: cs, cs/min
 */
function getMyCS(pobj, length) {
  var cs = pobj['stats']['minionsKilled'] + pobj['stats']['neutralMinionsKilled'];
  var csmin = cs / length;
  return [cs, csmin];
}

/**
 * Gets my League Stats
 * League Stats are tier, division, current LP, and promo status
 * Returns as an array, all are strings except LP which is an int
 */
function getMyLeagueStats() {
  var url = 'https://' + getInfo('region') + '.api.pvp.net/api/lol/' + getInfo('region') + '/v2.5' + '/league/by-summoner/' + getInfo('summoner_id') + '?api_key=' + getInfo('api_key');
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);
    var stats = {};
    var division, lp, tier, promos;
    stats['tier'] = data[getInfo('summoner_id')][0]['tier'];
    for(i = 0; i < data[getInfo('summoner_id')][0]['entries'].length; i++) {
      if(data[getInfo('summoner_id')][0]['entries'][i]['playerOrTeamName'] == getInfo('summoner_name')) {
        stats['division'] = data[getInfo('summoner_id')][0]['entries'][i]['division'];
        stats['lp'] = data[getInfo('summoner_id')][0]['entries'][i]['leaguePoints'];
        stats['promos'] = 'No';
        if(data[getInfo('summoner_id')][0]['entries'][i]['miniSeries']) {
          if(data[getInfo('summoner_id')][0]['entries'][i]['miniSeries']['progress'] != 'NNN') {
            stats['promos'] = 'Yes';
          }
        }
        //return [tier, division, lp, promos];
        return stats;
      }
    }
  }
  else if(status == 'exit') {
    return 'exit';
  }
  else if(status) { //wait 10 seconds then call again
    Utilities.sleep(10000);
    return getMyLeagueStats();
  }
}

/**
 * Get a player's total damage dealt to champion stat
 * The pobj determines the player who's stats to get
 */
function getChampionDamageDealt(pobj) {
  return pobj['stats']['totalDamageDealtToChampions'];
}

/**
 * Get the team's total damage
 * Takes the match to check for and the teamId for the team to check for
 */
function getTotalTeamDamage(match, teamId) {
  var participants = match['participants'];
  var total = 0;
  for(i = 0; i < participants.length; i++) {
    if(participants[i]['teamId'] == teamId) {
      total += participants[i]['stats']['totalDamageDealtToChampions']
    }
  }
  return total;
}

/**
 * Get the deltas for all the time periods in the game
 * Takes the participant to get the deltas for and the row to insert into
 */
function getDeltas(participant, row) { 
  //Note that due to the nature of how they were implemented by Riot the last delta is 30m to end of game
  var deltaTypes = ['creepsPerMinDeltas', 'goldPerMinDeltas', 'csDiffPerMinDeltas'];
  var deltaColumns = ['CS/Min Delta', 'Gold Delta', 'CS/Min Diff Delta'];
  // listed with a space so concat will work out nicer
  var deltaColumnTimes = [' 0 to 10', ' 10 to 20', ' 20 to 30', ' 30 to End'];
  var deltaTimes = ['zeroToTen', 'tenToTwenty', 'twentyToThirty', 'thirtyToEnd'];
  var deltas = participant['timeline'];  
  
  for(var deltaCount = 0; deltaCount <= 2; deltaCount++) {
    for(var deltaTimeCount = 0; deltaTimeCount <= 3; deltaTimeCount++) {
      if(deltas[deltaTypes[deltaCount]][deltaTimes[deltaTimeCount]]) {
        setCell(deltaColumns[deltaCount].concat(deltaColumnTimes[deltaTimeCount]), row, deltas[deltaTypes[deltaCount]][deltaTimes[deltaTimeCount]]);
      }
    }
  }
}

/**
 * Checks if we are duoing and sets if we are
 * Takes the match, the row, and an array of player names as strings
 */
function setDuoer(match, row, players) {
  // Note that the way that this checks if we are duoing checks by seeing if we have duo'd with this person before
  // So you WILL have to manually enter it the first time you duo with a player
  // Also note that if you queue into a game with multiple players on your team that you have duo'd with before
  // This may incorrectly assign the duoing player
  // Hopefully this affects such a small percentage of players that it won't matter
  
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var index = getSheetTranslationIndex('Duoer') - 1; 
  var values = s.getDataRange().getValues();
  for(i = values.length - 1; i > 0; i--) { // go in reverse order since we're most likely to keep duoing with people
    if(players.indexOf(values[i][index]) != -1) {
      setCell('Duoer', row, values[i][index]);
      var pobj = getParticipantObjByName(match, values[i][index]);
      var role = getRoleFromParticipantObj(pobj);
      setCell('Duo Role', row, role); 
      break;
    }
  }   
}

/**
 * Get the number of dragons and barons for each team
 */
function getDragonsBarons(match, teamId) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var myTeamIndex = teamId == 100 ? 0 : 1;
  var enemyTeamIndex = myTeamIndex == 0 ? 1 : 0;
  var neutralObjStats = {'myDragons': match['teams'][myTeamIndex]['dragonKills'],
                         'myBarons' : match['teams'][myTeamIndex]['baronKills'],
                         'enemyDragons' : match['teams'][enemyTeamIndex]['dragonKills'],
                         'enemyBarons' : match['teams'][enemyTeamIndex]['baronKills'],};
  return neutralObjStats;
}
  
/**
 * Get the bans, in order of ban
 */
function getBans(match) {
  var bans = match['teams'][0]['bans'].concat(match['teams'][1]['bans']);
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var champs = [];
  for(i = 1; i < bans.length+1; i++) {
    for(j = 0; j < bans.length; j++) {
      if(bans[j]['pickTurn'] == i) {
        var champ = getChampionTranslation(bans[j]['championId']);
        if(champ == 'exit') {
          return 'exit';
        }
        champs.push(champ);
        break;
      }
    }
  }
  return champs;
}

/**
 * Get stats on whether the given team got the objective first
 * First: blood, tower, inhib, dragon, baron
 */
function getFirstStats(match, teamId) {
  var myTeamIndex = teamId == 100 ? 0 : 1;
  var firstStats = {'firstBlood' : (match['teams'][myTeamIndex]['firstBlood']) ? 'Yes' : 'No',
                    'firstTower' : (match['teams'][myTeamIndex]['firstTower']) ? 'Yes' : 'No',
                    'firstInhibitor' : (match['teams'][myTeamIndex]['firstInhibitor']) ? 'Yes' : 'No',
                    'firstDragon' : (match['teams'][myTeamIndex]['firstDragon']) ? 'Yes' : 'No',
                    'firstBaron' : (match['teams'][myTeamIndex]['firstBaron']) ? 'Yes' : 'No',};
  return firstStats;
}

/**
 * Get an array of all the summoner names of the players on a team
 */
function getTeamPlayers(match, teamId) {
  // since the participantIdentities portion doesn't track teamId
  // we determine it by looking at participants to find out the teamId
  // NOTE: it looks like participants is always in participantId sorted order
  
  var pOnTeam = [];
  var summoners = [];
  
  for(i = 0; i < match['participants'].length; i++) {
    if(match['participants'][i]['teamId'] == teamId) {
      pOnTeam.push(i+1);
    }
  }
  
  for(i = 0; i < match['participantIdentities'].length; i++) {
    if(pOnTeam.indexOf(match['participantIdentities'][i]['participantId']) != -1) {
      summoners.push(match['participantIdentities'][i]['player']['summonerName']);
    }
  }
  return summoners;    
}

/**
 * Get the total kills for a team
 */
function getTotalKills(match, teamId) {
  var participants = match['participants'];
  var total = 0;
  for(i = 0; i < participants.length; i++) {
    if(participants[i]['teamId'] == teamId) {
      total += participants[i]['stats']['kills']
    }
  }
  return total;
}

/**
 * Get the total deaths for a team
 */
function getTotalDeaths(match, teamId) {
  var participants = match['participants'];
  var total = 0;
  for(i = 0; i < participants.length; i++) {
    if(participants[i]['teamId'] == teamId) {
      total += participants[i]['stats']['deaths']
    }
  }
  return total;
}

/**
 * Get if we had the highest KDA on our team or not
 */
function getHighestKDA(row) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var myKDA = sheet.getRange(row, getSheetTranslationIndex('My KDA')).getValue();
  var myTopKDA = sheet.getRange(row, getSheetTranslationIndex('My Top KDA')).getValue();
  var myJungleKDA = sheet.getRange(row, getSheetTranslationIndex('My Jungle KDA')).getValue();
  var myMidKDA = sheet.getRange(row, getSheetTranslationIndex('My Mid KDA')).getValue();
  var myADCKDA = sheet.getRange(row, getSheetTranslationIndex('My ADC KDA')).getValue();
  var mySupportKDA = sheet.getRange(row, getSheetTranslationIndex('My Support KDA')).getValue();
  if(myKDA >= myTopKDA && myKDA >= myJungleKDA && myKDA >= myMidKDA && myKDA >= myADCKDA && myKDA >= mySupportKDA) {
    return 'Yes';
  }
  else {
    return 'No';
  }
}

/**
 * Get stats based on our wards
 * Wards placed, killed, and pinks
 */
function getWardStats(pobj) {
  return [pobj['stats']['wardsPlaced'], pobj['stats']['wardsKilled'], pobj['stats']['visionWardsBoughtInGame']];
}

/**
 * Get stats based on our lane opponent, used to compare
 * teamId is the opponent's team ID
 */
function getLaneOpponentStats(match, pobj, teamId) { 
  //kills, deaths, assists, kda, damage to champs, ward stats, kill contribution percentage
  var stats = getPlayerStats(pobj); //kills, deaths, assists, kda, total cs
  var damage = getChampionDamageDealt(pobj); //damage dealt as a number
  var totalDamage = getTotalTeamDamage(match, teamId); //team's total damage
  var wards = getWardStats(pobj); //wards placed, wards killed, pinks placed
  var totalKills = getTotalKills(match, teamId); // team's kills
  var laneOppStats = {'kills' : stats['kills'],
                      'deaths': stats['deaths'],
                      'assists': stats['assists'],
                      'kda': stats['kda'],
                      'minions': stats['minions'],
                      'damageToChamps': damage/totalDamage,
                      'wardsPlaced': wards[0],
                      'wardsDestroyed': wards[1],
                      'visionWardsBought': wards[2],
                      'killContributionPercentage': (stats['kills'] + stats['assists'])/totalKills};
  return laneOppStats;
}

/**
 * Get and set our promos status as well as LP
 * oldLP is the value before the most recent update, curLP is the current LP
 * previousPromos is the 'Yes'/'No' string from the sheet
 * leaguePromos is either the promo game results string or 'No'
 */
function getAndSetPromosLP(oldLP, curLP, previousPromos, leaguePromos, row) {
  // we're either not in promos or in promos with no games played
  if(leaguePromos == 'NNN' || leaguePromos == 'NNNNN' || leaguePromos == 'No') {
    setCell('Promos', row, 'No');
  }
  else { // we're in promos
    setCell('Promos', row, 'Yes');
  }
  // TODO: we still need to add the case to fix the final game of promos
  
  setCell('Current LP', row, curLP);
  setCell('LP Change', row, curLP - oldLP);
  if(previousPromos == 'Yes' && curLP == 0) {
    setCell('LP Change', row, 100); // we call a won promos +100
  }
  // note that the below modification fails if we don't update frequently enough
  // so if we won a lot of games to get to a 60 difference, this will fail for sure
  if(oldLP == 0 && curLP > 60) {
    setCell('LP Change', row, -100); // we call a demotion -100
  }
}

/**
 * Checks if the response code has an error
 * Returns false if we got 200 OK, true if for some reason we failed
 * Displays alerts to help the user
 */
function checkStatusError(response) {
  // TODO: check for the 429 code wait time in string and wait that time instead
  // NOTE: this is not done because Riot's responses don't always include it, and our timeout codes never got that field
  var code = response.getResponseCode();
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  if(code == 200) {
    return false;
  }
  else if(code == 429) { // calling function will wait 10s and call itself again
    return true;
  }
  // returning exit here will cause all the functions to return, and eventually stop the code
  // this is done since there's no function to terminate the execution
  // if this happens, there's some sort of major problem (like their server is offline) preventing us from running it
  // we won't be able to fully update the code so we'll just terminate
  else if(code == 500 || code == 503) {
    Browser.msgBox("Error, Riot unavailable. Please try again later.");
    return "exit";
  }
  else {
    Browser.msgBox("Error, please make sure everything is configured correctly.");
    return "exit";
  }
}
