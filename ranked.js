/*
 * onOpen is the function called when the sheet is loaded
 * It calls the run function to start populating data
 */
function onOpen(e) {
  buildMenu(e);
  run();
}

/*
 * Gets an array of all games we haven't recorded and then populates the data for it on our sheet
 */
function run() {
  checkPartialRow(getFirstEmptyRow()-1); // delete a potentially partially filled row
  var match_history = findUniqueMatchIds();
  if(!match_history || match_history == 'exit') {
    return 'exit';
  }
  var result = populate(match_history);
  // indicates a partial entry so delete the most recent row
  if(result == 'exit') {
    deleteRow(getFirstEmptyRow() - 1);
  }
}

/*
 * Gets an array of all games we haven't recorded and then populates the data for it on our sheet
 * A special version in order to populate while skipping the league info
 */
function runInitial() {
  checkPartialRow(getFirstEmptyRow()-1); // delete a potentially partially filled row
  var match_history = findUniqueMatchIds();
  if(!match_history || match_history == 'exit') {
    return 'exit';
  }
  var result = populate(match_history, null, true);
  // indicates a partial entry so delete the most recent row
  if(result == 'exit') {
    deleteRow(getFirstEmptyRow() - 1);
  }
}

/*
 * Build the menu
 */
function buildMenu(e) {
  // building the menu works differently if it's fully published as an add-on, so we'll have to do it two ways
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Ranked')
    .addItem('Run', 'run')
    .addItem('Run Initial', 'runInitial')
    .addItem('Correct Row', 'fixRow')
    .addToUi();
  /*var menu = SpreadsheetApp.getUi().createAddonMenu();
  if(e && e.authMode == ScriptApp.AuthMode.NONE) {
    menu.addItem('Run', 'run');
    menu.addItem('Correct Row', 'fixRow'); // since we can't actually pass arguments
  }*/
}

/*
 * Delete the row indicated by row
 */
function deleteRow(row) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  sheet.deleteRow(row);
}

function checkPartialRow(row) {
  var s = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = s.getSheetByName('Data');
  if(sheet.getRange(row, getSheetTranslationIndex('Their AFK')).getValue() === '') {
    deleteRow(row);
  }
}

/*
 * Get our information from the info sheet
 * The only fields applicable are the api key, region, summoner name, season, summoner id, and check duoer
 */
function getInfo(value) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Configuration');
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
  if(value == 'correct_row') {
    var row = sheet.getRange('B7').getValue();
    if(row) {
      return row;
    }
    else {
      Browser.msgBox("Error, please enter a row number to be corrected when using this option")
      return;
    }
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

/*
 * Find the match ids from our match history that we haven't added to the sheet yet
 * Returns them as an array in chronological order
 */
function findUniqueMatchIds() {
  match_history = getMatchHistoryIds();
  if(match_history === 'exit') {
    return 'exit';
  }
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

/*
 * For a given set of match ids, populate the spreadsheet data
 */
function populate(match_history, specificRow, discludeLeague) {
  // call all the necessary functions to update the spreadsheet
  // some functions will update the values themselves
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  for(n = 0; n < match_history.length; n++) {
    var row;
    if(!specificRow) {
      sheet.appendRow([match_history[n]]);
      row = getFirstEmptyRow() - 1;
    }
    else {
      row = specificRow;
    }
    var match = getMatch(match_history[n]);
    if(match == 'exit') {
      return 'exit';
    }
    setCell('Patch', row, getPatch(match));
    var dt = getMatchDate(match);
    setCell('Date', row, dt[0]);
    setCell('Time', row, dt[1]);
    setCell('Length', row, getMatchLength(match));
    var pid = getMatchParticipantId(match);
    if(pid === 'exit') {
      return 'exit';
    }
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
    setCell('Kill Contribution', row, (stats['kills'] + stats['deaths'])/getTotalKD(match, teamId, 'kills'));
    setCell('Death Contribution', row, stats['deaths']/getTotalKD(match, teamId, 'deaths'));
    setCell('Highest KDA', row, getHighestKDA(row));
    if(!discludeLeague) {
      leagueStats = getMyLeagueStats(); 
      if(leagueStats == 'exit') {
        return 'exit';
      }
      // will come up undefined if we've changed our summoner name previously
      if(leagueStats) {
        setCell('League', row, leagueStats['tier']);
        setCell('Division', row, leagueStats['division']);
        setCell('Current LP', row, leagueStats['lp']);
        var oldLP = sheet.getRange(row-1, getSheetTranslationIndex('Current LP')).getValue();
        getAndSetPromosLP(oldLP, leagueStats['lp'], sheet.getRange(row-1, getSheetTranslationIndex('Promos')).getValue(), leagueStats['promos'], row);
      }
    }
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
    var oppPobj = getOpponentParticipantObj(match, row, getMyRole(row), teamId);
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
    setCell('Kill Contribution Diff', row, (stats['kills'] + stats['assists'])/getTotalKD(match, teamId, 'kills')-laneOpponentStats['killContributionPercentage']);   
    checkAllAFK(match, teamId, row);
  }
}

function getFirstEmptyRow() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  return sheet.getLastRow() + 1;
}

/*
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

/*
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

/*
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

/*
 * Set the cell at column, row, to a specific value
 * Column is the header name, not the letter or index value
 */
function setCell(column, row, value) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  sheet.getRange(getSheetTranslation(column)+row).setValue(value);
}

/*
 * Get the summoner id by name
 */
function getSummonerId() {
  var url = 'https://' + getInfo('region') + '.api.pvp.net/api/lol/' + getInfo('region') + '/v1.4' + '/summoner/by-name/' + encodeURIComponent(getInfo('summoner_name')) + '?api_key=' + getInfo('api_key');
  var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);  
    return data[getInfo('summoner_name').toLowerCase()]['id'];
  }
  else if(status == 'exit') {
    return 'exit';
  }
  else if(typeof(status) == 'number') {
    Utilities.sleep(status);
    return getSummonerId();
  }
  else { // default wait 10 seconds if we fail but don't know why
    Utilities.sleep(10000);
    return getSummonerId();
  }
}

/*
 * Get the game ids for our matches
 * Note that this returns only ranked solo queue 5x5 games as per the current implementation
 * Returns an array of all the matchIds
 */
function getMatchHistoryIds(mode) {
  // we get match ids because the match history only has our information
  // and since we want to track other player kdas then we're going to need the full match info per match
  // NOTE: season is going to have to be changed each season
  mode = typeof mode !== 'undefined' ? mode : '?rankedQueues=RANKED_SOLO_5x5';
  season = getInfo('season') !== '' ? '&seasons=' + getInfo('season') : '';
  var url = 'https://' + getInfo('region') + '.api.pvp.net/api/lol/' + getInfo('region') + '/v2.2' + '/matchlist/by-summoner/' + getInfo('summoner_id') + mode + season + '&api_key=' + getInfo('api_key'); 
  var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);
    var s = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = s.getSheetByName('Data');
    var matchIds = [];
    if(!data["matches"]) {
      return "exit";
    }
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
    else if(typeof(status) == 'number') {
    Utilities.sleep(status);
    return getMatchHistoryIds(mode);
  }
  else { // default wait 10 seconds if we fail but don't know why
    Utilities.sleep(10000);
    return getMatchHistoryIds(mode);
  }
}

/*
 * Get the match details from a given matchId
 * Returns the json object of the match
 */
function getMatch(matchId) {
  var url = 'https://' + getInfo('region') + '.api.pvp.net/api/lol/' + getInfo('region') + '/v2.2' + '/match/' + matchId + '?api_key=' + getInfo('api_key');
  var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);
    return data;
  }
  else if(status == 'exit') {
    return 'exit';
  }
  else if(typeof(status) == 'number') {
    Utilities.sleep(status);
    return getMatch(matchId);
  }
  else { // default wait 10 seconds if we fail but don't know why
    Utilities.sleep(10000);
    return getMatch(matchId);
  }
}

/*
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

/*
 * Get the duration of a match
 */
function getMatchLength(match) {
  return Math.round(match['matchDuration']/60);
}

/*
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
  Browser.msgBox("Error: could not find your summoner name. If you have changed it, please run it with the old summoner name");
  return 'exit';
}

/*
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

/*
 * Get the participant object for our lane opponent
 */
function getOpponentParticipantObj(match, row, role, teamId) {
  // we would normally calculate this using their already given id, but that clearly doesn't work since role can be wrong
  // instead we find the PID that corresponds to the champion on their team with the same role
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');  
  var theirChampion = sheet.getRange(row, getSheetTranslationIndex('Their '.concat(role))).getValue();
  var participants = match['participants'];
  for(i = 0; i < participants.length; i++) {
    if(theirChampion === getChampionTranslation(participants[i])) {
      return participants[i];
    }
  }
}

/*
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

/*
 * Get the id of the team from their participant object
 */
function getMatchTeamId(participant) {
  return participant['teamId'];
}

/*
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

/*
 * Get the role from a participant object
 * Note: every champion gets assigned a role, even if they're all the same
 */
function getRoleFromParticipantObj(participant) {
  var role = participant['timeline']['role'];
  var lane = participant['timeline']['lane'];
  if(lane == 'TOP') {
    if(role == 'DUO_SUPPORT' && checkSummonerIsSmite(participant)) {
      return 'Jungle';
    }
    return 'Top';
  }
  else if(lane == 'JUNGLE' && checkSummonerIsSmite(participant)) {
    return 'Jungle';
  }
  else if(lane == 'MIDDLE') {
    if(role == 'DUO_SUPPORT' && checkSummonerIsSmite(participant)) { 
      return 'Jungle';
    }
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
      return 'Bot';
    }
  }
  // we couldn't determine their role at this time
  // likely an AFK or player got tagged as jungle when they're not jungle
  else { 
    return 'Unknown'; 
  }
}

/*
 * Get my champion from the partucupant object
 */
function getMyChampion(participant) {
  return getChampionTranslation(participant['championId']);
}

/*
 * Get champions and their kda
 * teamId is our teamId so we can tell which champs are which team
* Uses additional metrics to determine roles since Riot messes up sometimes
 */
function getAndSetChampionStats(match, teamId, row) {
  var participants = match['participants'];
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');  
  var valid = {"myTeam" : [],
               "theirTeam" : []};
  // note any roles in invalid are ignored since we determined the role is wrong
  var invalid = {"myTeam" : [],
               "theirTeam" : []};
  for(var i = 0; i < participants.length; i++) {
    var team = (participants[i]['teamId'] === teamId ? 'myTeam' : 'theirTeam');
    var role = getRoleFromParticipantObj(participants[i]);
    var stats = getPlayerStats(participants[i]);
    var details = {
      'Champion' : getChampionTranslation(participants[i]['championId']),
      'Role' : role,
      'CS' : stats['minions'],
      'KDA' : stats['kda'],
      'Smite' : checkSummonerIsSmite(participants[i])
    }; 
    // if the role is Bot (means we have a problem determining ADC/Support)
    // or if someone got flagged jungle without smite
    // or the role is already filled by another champion, it's invalid
    var checkRole = checkRoleExists(valid[team], role);
    if(checkRole !== false) { // because checkRole returns 0 sometimes
      var checkValid = checkValidRole(valid[team][checkRole], details, role);
      if(checkValid === 1) { // the previously labeled valid champ was invalid
        invalid[team].push(valid[team][checkRole]);
        valid[team].splice(checkRole, 1, details);
      }
      else { // the currently considered champ is invalid
        invalid[team].push(details);
      }
    }
    else if(role === 'Unknown' || role === 'Bot') {
      invalid[team].push(details);
    }
    else { // role is valid so set it as such
      valid[team].push(details);
    }
  }
  /* 

  We can start by checking if there's only 1:1
    Fix them, fix the jungle case if we tag jungler without smite
    If nobody has smite, they become jungle by default
  Then we can start by trying to fix any double bot issue we detect
  Then fix jungle afterwards
  Slot any single solo bots now, if they slot easily, fine
    if there's double bot missing with only single solo bot
    slot based on champion
  If support is missing, slot fewest cs into support
  Slot randomly from here

  We can fix if invalid = 1
  We fix double bot issues
  We fix issues related to camping lanes and jungle doesn't get tagged
  We fix issues with a single dude being called bot

  */
  
  for(var i = 0; i < 2; i++) { // once for each team
    team = (i === 0 ? 'myTeam' : 'theirTeam');
    var count = 0;
    while(invalid[team].length != 0) { // as long as we still haven't finished fixing all the roles
      var missing = getMissingRoles(valid[team]);
      if(missing.length === 1) {
        valid[team] = fixSingleRole(valid[team], invalid[team].splice(0, 1)[0], missing[0]);
        break;
      }
      else {
        var results = fixDuoBot(valid[team], invalid[team]); // fix any potential duo bot issue
        valid[team] = results[0];
        invalid[team] = results[1];
        results = fixJungler(valid[team], invalid[team]); // try to fix the jungler
        valid[team] = results[0];
        invalid[team] = results[1];
        results = fixSoloBot(valid[team], invalid[team]); // try to fix an issue with single SOLO BOT
        valid[team] = results[0];
        invalid[team] = results[1];
        results = fixSupport(valid[team], invalid[team]); // try to properly pick the support
        valid[team] = results[0];
        invalid[team] = results[1];

      }
      // if after a few times we didn't fix it, start randomly assigning
      // this should almost never happen and is just a fail safe so we don't crash and burn
      if(count > 3 && invalid[team].length >= 1) {
        invalid[team][0]['Role'] = missing.splice(0, 1)[0];
        valid[team].push(invalid[team].splice(0, 1)[0]);
      }
      count++;
    }
  }

  
  // set all the columns now that we got all the roles correctly
  for(var i = 0; i < 5; i++) {
    setCell('My '.concat(valid['myTeam'][i]['Role']), row, valid['myTeam'][i]['Champion']);
    setCell('My '.concat(valid['myTeam'][i]['Role']).concat(' KDA'), row, valid['myTeam'][i]['KDA']);
    setCell('Their '.concat(valid['theirTeam'][i]['Role']), row, valid['theirTeam'][i]['Champion']);
    setCell('Their '.concat(valid['theirTeam'][i]['Role']).concat(' KDA'), row, valid['theirTeam'][i]['KDA']);
  }
}

/*
 * Check if a role exists within an array of json objects
 * Called only by getAndSetChampionStats
 * If true returns the index that the role is in
 * If false, returns false
 */
function checkRoleExists(champs, role) {
  for(var i = 0; i < champs.length; i++) {
    if(champs[i]['Role'] === role) {
      return i;
    }
  }
  return false;
}

/*
 * Given two players that are on the same team with the same role
 * Check which player is the given role and which is not
 * Returns 0 for the first player, 1 for the second player
 */
function checkValidRole(player0, player1, role) {
  /*
  We can guarantee that double jungle means both have smite
  Support taking smite will mess this up but I only expect top to take smite
  
  If the role is top or mid, call the one with more CS top/mid
  If the role is support, call the one with less CS support
  If the role is ADC, check if one is an ADC champ and call them ADC
    If both are ADC, call the one with more CS ADC
      This handles situations where you get double ADC bot
  If the role is jungle, call the one with less CS jungle
  */

  if(role === 'Mid') {
    var isPlayer0Mid = checkChampIsMid(player0['Champion']);
    var isPlayer1Mid = checkChampIsMid(player1['Champion']);
    if(isPlayer0Mid && !isPlayer1Mid) {
      return 0;
    }
    if(isPlayer1Mid && !isPlayer0Mid) {
      return 1;
    }
    // otherwise default to more cs
    return (player0['CS'] >= player1['CS'] ? 0 : 1);
  }
  else if(role === 'Top' || role === 'Mid') {
    var isPlayer0Top = checkChampIsTop(player0['Champion']);
    var isPlayer1Top = checkChampIsTop(player1['Champion']);
    if(isPlayer0Top && !isPlayer1Top) {
      return 0;
    }
    if(isPlayer1Top && !isPlayer0Top) {
      return 1;
    }
    // otherwise default to cs, it doesn't matter at this point
    return (player0['CS'] >= player1['CS'] ? 0 : 1);
  }
  else if(role === 'Jungle' || role === 'Support') {
    return (player0['CS'] <= player1['CS'] ? 0 : 1);
  }
  else {
    var isPlayer0ADC = checkChampIsADC(player0['Champion']);
    var isPlayer1ADC = checkChampIsADC(player1['Champion']);
    if(isPlayer0ADC && !isPlayer1ADC) {
      return 0;
    }
    if(isPlayer1ADC && !isPlayer0ADC) {
      return 1;
    }
    // otherwise default to more cs method
    return (player0['CS'] >= player1['CS'] ? 0 : 1);
  }
}

/*
 * Check if the champion is a known ADC champion
 * Helps us in determining who should be ADC when it messes up
 */
function checkChampIsADC(champion) {
  var adcs = ['Ashe', 'Caitlyn', 'Corki', 'Draven', 'Ezreal', 'Graves',
  'Jinx', 'Kalista', "Kog'Maw", 'Lucian', 'Miss Fortune', 
  'Sivir', 'Tristana', 'Twitch', 'Varus', 'Vayne'];
  if(adcs.indexOf(champion) != -1) {
    return true;
  }
  return false;
}
  
/*
 * Check if the champion is a known Top champion
 * Helps us in determining who should be TOP when it messes up
 */
function checkChampIsTop(champion) {
  var tops = ['Malphite', 'Renekton', 'Fiora', 'Irelia', 'Darius', 'Gnar',
              'Shen', 'Jax', 'Nasus', 'Illaoi', 'Garen', 'Vladimir', 
              'Dr. Mundo', 'Trundle', 'Tryndamere', 'Rengar', 'Olaf', 
              'Wukong', 'Tahm Kench', 'Teemo', 'Pantheon', 'Hecarim', 
              'Singed', 'Volibear', 'Rumble', 'Aatrox', 'Maokai', 
              'Shyvana', 'Yorick'];
  if(tops.indexOf(champion) != -1) {
    return true;
  }
  return false;
}

/*
 * Check if the champion is a known Mid champion
 * Helps us in determining who should be Mid when it messes up
 */
function checkChampIsMid(champion) {
  var mids = ['Ahri', 'Lux', 'LeBlanc', 'Anivia', 'Brand', 'Twisted Fate', 
              'Oriana', 'Kassadin', 'Annie', 'Azir', 'Viktor', 'Syndra', 
              'Ekko', 'Malzahar', 'Diana', 'Katarina', 'Talon', 'Morgana',
              'Xerath', 'Veigar', 'Ezreal', "Vel'Koz", 'Ziggs', 'Cassiopeia',
              'Karthus', 'Zilean', 'Zyra', 'Varus', "Kog'Maw", 'Karma'];
  if(mids.indexOf(champion) != -1) {
    return true;
  }
  return false;
}



/*
 * Check if the player was AFK the entire game
 */
function checkAFK(player) {
  // check the player's CS and KDA, if both are 0, they never connected
  // only role that will get 0 CS is support, and it's basically impossible to have a zero KDA
  return (player['CS'] === 0 && player['KDA'] === 0);
}

/*
 * Returns an array of all the roles we have not populated
 * Takes in the valid json object
 */
function getMissingRoles(data) {
  var roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
  for(var i = 0; i < data.length; i++) {
    for(var j = 0; j < roles.length; j++) {
      if(roles[j] === data[i]['Role']) {
        roles.splice(j, 1);
        break;
      }
    }
  }
  return roles;
}

/*
 * Check if any players were AFK in the match
 * Uses the timeline data to check
 * Takes in the match, teamId, and the row
 */
function checkAllAFK(match, teamId, row) {

  /*
  We define AFK to be having 35% or less XP than the average
  Where the average doesn't consider non-zero entities
  NOTE: We are testing 35% right now based on a a previous game to see if it breaks anything by being that high
  There was a game I got crushed in but I still had 52%, I expect as high as 40% is okay
  47% definitely broke it
  35% broke it and the value it broke on was 28%
  I'm leaving it at 35 but if I publish, 25% is a better value
  */
  var deltas = [];
  var deltaTimes = ['zeroToTen', 'tenToTwenty', 'twentyToThirty', 'thirtyToEnd'];
  var myAFK = 0;
  var theirAFK = 0;
  var afk = false;
  for(var i = 0; i < 10; i++) {
    deltas.push(getXPPerMinuteDelta(match['participants'][i]));
  }
  var averageDeltas = getAverageDeltas(deltas, deltaTimes);
  for(var i = 0; i < deltas.length; i++) {
    for(var j = 0; j < deltaTimes.length; j++) {
      if(deltas[i][deltaTimes[j]] <= (averageDeltas[deltaTimes[j]] * 0.35)) {
        if(match['participants'][i]['teamId'] == teamId) {
          myAFK++;
        }
        else {
          theirAFK++;
        }
        break;
      }
    }
  }
  setCell('My AFK', row, myAFK);
  setCell('Their AFK', row, theirAFK);
}

/*
 * Get a player's XPPerMinute Delta
 * Takes in the participant object for a player
 * Returns the delta as a JSON object
 */
function getXPPerMinuteDelta(pobj) {
  return pobj['timeline']['xpPerMinDeltas'];
}

/*
 * Get all the average deltas for a given set of deltas
 * deltas is an array of all the deltas for players
 * deltaTimes is an array of all the time period names
 * Returns a json object mapping time to delta
 */
function getAverageDeltas(deltas, deltaTimes) {
  var data = {};

  for(var i = 0 ; i < deltaTimes.length; i++) {
    data[deltaTimes[i]] = 0;
  }

  for(var i = 0; i < deltas.length; i++) {
    for(var j = 0; j < deltaTimes.length; j++) {
      if(deltas[i][deltaTimes[j]] != 0) { 
        // even though we're taking an average over N while potentially not summing N items
        // a lower average is actually quite okay with us so we don't really care
        data[deltaTimes[j]] += deltas[i][deltaTimes[j]] / deltas.length;
      }
    }
  }
  for(var i = 0; i < deltaTimes.length; i++) {
    if(data[deltaTimes[i]] == 0) {
      delete data[deltaTimes[i]];
    }
  }
  return data;
}

/*
 * Check if a player has smite as a summoner
 */
function checkSummonerIsSmite(pobj) {
  return (pobj['spell1Id'] === 11 || pobj['spell2Id'] === 11);
}

/*
 * Fix roles when only one role is missing
 * Valid is an array of json objects for players
 * Player is a json object for a player
 * Returns the updated valid array for the team
 */
function fixSingleRole(valid, player, role) {
  //slot 1:1 except when we have to fix jungle issues
  if(role === 'Jungle' && !player['Smite']) {
    var jungler = findJungler(valid);
    if(!jungler) { // nobody has smite so we're jungle by default
      player['Role'] = role;
      valid.push(player);
      return valid;
    }
    player['Role'] = jungler['Role'];
    jungler['Role'] = 'Jungle';
    valid.push(jungler);
    valid.push(player);
  }
  else {
    player['Role'] = role;
    valid.push(player);
  }
  return valid;
}

/*
 * Check if we have one person coming up as solo bot and fix it
 * Returns updated valid and invalid JSON objects
 */
function fixSoloBot(valid, invalid) {
  var missing = getMissingRoles(valid);
  var bot;
  var count = 0;
  for(var i = 0; i < invalid.length; i++) {
    if(invalid[i]['Role'] === 'Bot') {
      bot = i;
      count++;
    }
  }
  if(bot && count === 1) { // we detected a solo bot
    if(missing.indexOf('ADC') !== -1 && missing.indexOf('Support') === -1) {
      invalid[bot]['Role'] = 'ADC';
      valid.push(invalid.splice(bot, 1)[0]);
    }
    else if(missing.indexOf('ADC') === -1 && missing.indexOf('Support') !== -1) {
      invalid[bot]['Role'] = 'Support';
      valid.push(invalid.splice(bot, 1)[0]);
    }
    if(missing.indexOf('ADC') === -1 && missing.indexOf('Support') === -1) { // both are still missing
      // check if im an adc
      if(checkChampIsADC(invalid[bot]['Champion'])) {
        invalid[bot]['Role'] = 'ADC';
        valid.push(invalid.splice(bot, 1)[0]);
      }
      else { // check if im in an extended list of adcs before calling me support
        var adcs = ['Kindred', 'Quinn', 'Urgot'];
        if(adcs.indexOf(invalid[bot]['Champion'] !== -1)) {
          invalid[bot]['Role'] = 'ADC';
        }
        else {
          invalid[bot]['Role'] = 'Support';
        }
        valid.push(invalid.splice(bot, 1)[0]);
      }
    }
  }
  return [valid, invalid];
}

/*
 * Fix the jungler role if we can
 * * Returns updated valid and invalid JSON objects
 */
function fixJungler(valid, invalid) {
  var jungler = findJungler(invalid);
  if(jungler) {
    for(var i = 0; i < invalid.length; i++) {
      if(invalid[i] === jungler) {
        invalid.splice(i, 1);
        break;
      }
    }
    jungler['Role'] = 'Jungle';
    valid.push(jungler);
  }
  return [valid, invalid];
}

/*
 * Try to fix a missing support
 * * Returns updated valid and invalid JSON objects
 */
function fixSupport(valid, invalid) {
  // call fewest cs the support, including afk I guess
  var missing = getMissingRoles(valid);
  if(missing.indexOf('Support') !== -1) {
    var smallestIndex = 0;
    for(var i = 1; i < invalid.length; i++) {
      if(invalid[i]['CS'] < invalid[smallestIndex]['CS']) {
        smallestIndex = i;
      }
    }
    invalid[smallestIndex]['Role'] = 'Support';
    valid.push(invalid.splice(smallestIndex, 1)[0]);
  }
  return [valid, invalid];
}

/*
 * Find out who is jungler from the already categorized players
 * Valid is an array of json player objects
 * Returns the jungle candidate or null if there are none
 */
function findJungler(valid) {
  var jungle = [];
  for(var i = 0; i < valid.length; i++) {
    // find any potential jungle candidates and remove them
    if(valid[i]['Smite']) {
      jungle.push(valid[i]);
      valid.splice(i, 1);
    }
  }
  // if there's only one jungle candidate, return them
  if(jungle.length === 1) {
    return jungle[0];
  }
  // if there's multiple jungle candidates, find the one we're calling jungle
  // put the rest back into valid, return the jungle candidate
  else if(jungle.length > 1) {
    var smallestIndex = 0;
    for(var i = 1; i < jungle.length; i++) {
      if(jungle[i]['CS'] < jungle[smallestIndex]['CS']) {
        smallestIndex = i;
      }
    }
    var jungler = jungle.splice(smallestIndex, 1);
    for(var i = 0; i < jungle.length; i++) {
      valid.push(jungle[i]);
    }
    return jungler;
  }
  else {
    return null;
  }
}

/*
 * Check if there's an issue labeling the bot lane correctly
 * Fix it if there is
 * Returns an array [valid, invalid] as updated
 */
function fixDuoBot(valid, invalid) {
  // first check if there is a duo bot issue
  // if there is, decide who is adc, who is support, and fix
  var indexes = [];
  for(var i = 0; i < invalid.length; i++) {
    if(invalid[i]['Role'] === 'Bot') {
      indexes.push(i)
    }
  }
  
  if(indexes.length === 2) {
    // check for if only one is the adc champion first, then do cs method
    var champ0IsADC = checkChampIsADC(invalid[indexes[0]]['Champion']);
    var champ1IsADC = checkChampIsADC(invalid[indexes[1]]['Champion']);
    var adcIndex;
    var supportIndex;
    if(champ0IsADC && !champ1IsADC) {
      adcIndex = indexes[0];
      supportIndex = indexes[1];
    }
    else if(champ1IsADC && !champ0IsADC) {
      adcIndex = indexes[1];
      supportIndex = indexes[0];
    }
    else {
      adcIndex = (invalid[indexes[0]]['CS'] >= invalid[indexes[1]]['CS']) ? 0 : 1;
      supportIndex = (invalid[indexes[0]]['CS'] < invalid[indexes[1]]['CS']) ? 0 : 1;
    }
    
    invalid[adcIndex]['Role'] = 'ADC';
    invalid[supportIndex]['Role'] = 'Support';
    valid.push(invalid.splice(adcIndex, 1)[0]);
    // we have to find the new support index since it changes after we remove the adc item
    for(var i = 0; i < invalid.length; i++) {
      if(invalid[i]['Role'] === 'Support') {
        valid.push(invalid.splice(i, 1)[0]);
      }
    }
  }
  // if we don't actually update anything, then we return the same and nothing changes, which is fine
  return [valid, invalid];
}

/*
 * Get the name of a champion from its id
 */
function getChampionTranslation(championId) {
  var url = 'https://global.api.pvp.net/api/lol/static-data/na/v1.2/champion/' + championId + '?api_key=' + getInfo('api_key');
  var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  var status = checkStatusError(response);
  if(!status) {
    var json = response.getContentText();
    var data = JSON.parse(json);
    return data['name'];
  }
  else if(status == 'exit') {
    return 'exit';
  }
  else if(typeof(status) == 'number') {
    Utilities.sleep(status);
    return getChampionTranslation(championId);
  }
  else { // default wait 10 seconds if we fail but don't know why
    Utilities.sleep(10000);
    return getChampionTranslation(championId);
  }
}

/*
 * Get the result of a match
 * Returns the string 'Win' or 'Lose' accordingly
 */
function getMatchResult(pobj) {
  return (pobj['stats']['winner'] ? 'Win' : 'Lose');
}

/*
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

/*
 * Gets my cs stats for the game
 * Returns an array with the cs info
 * In the order: cs, cs/min
 */
function getMyCS(pobj, length) {
  var cs = pobj['stats']['minionsKilled'] + pobj['stats']['neutralMinionsKilled'];
  var csmin = cs / length;
  return [cs, csmin];
}

/*
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
  else if(typeof(status) == 'number') {
    Utilities.sleep(status);
    return getMyLeagueStats();
  }
  else { // default wait 10 seconds if we fail but don't know why 
    Utilities.sleep(10000);
    return getMyLeagueStats();
  }
}

/*
 * Get a player's total damage dealt to champion stat
 * The pobj determines the player who's stats to get
 */
function getChampionDamageDealt(pobj) {
  return pobj['stats']['totalDamageDealtToChampions'];
}

/*
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

/*
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
      if(deltas[deltaTypes[deltaCount]]) {
        if(deltas[deltaTypes[deltaCount]][deltaTimes[deltaTimeCount]]) {
          setCell(deltaColumns[deltaCount].concat(deltaColumnTimes[deltaTimeCount]), row, deltas[deltaTypes[deltaCount]][deltaTimes[deltaTimeCount]]);
        }
      }
    }
  }
}

/*
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

/*
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
  
/*
 * Get the bans, in order of ban
 */
function getBans(match) {
  var bans = match['teams'][0]['bans'].concat(match['teams'][1]['bans']);
  var champs = [];
  /* note that we do a hack here where we just assume ban[i] exists
  ban[i] might not exist if the team didn't ban 3 champions
  but javascript will just give us back a string undefined if it doesn't exist
  as their way of sending outofbounds
  and that works perfectly fine for us, so we just use it like that
  */
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

/*
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

/*
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

/*
 * Get the total kills or deaths for a team
 * type is a string either kills or deaths to denote which stat we get
 */
function getTotalKD(match, teamId, type) {
  var participants = match['participants'];
  var total = 0;
  for(i = 0; i < participants.length; i++) {
    if(participants[i]['teamId'] == teamId) {
      total += participants[i]['stats'][type]
    }
  }
  if(total == 0) { // just so we don't break
    total++;
  }
  return total;
}

/*
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

/*
 * Get stats based on our wards
 * Wards placed, killed, and pinks
 */
function getWardStats(pobj) {
  return [pobj['stats']['wardsPlaced'], pobj['stats']['wardsKilled'], pobj['stats']['visionWardsBoughtInGame']];
}

/*
 * Get stats based on our lane opponent, used to compare
 * teamId is the opponent's team ID
 */
function getLaneOpponentStats(match, pobj, teamId) { 
  //kills, deaths, assists, kda, damage to champs, ward stats, kill contribution percentage
  var stats = getPlayerStats(pobj); //kills, deaths, assists, kda, total cs
  var damage = getChampionDamageDealt(pobj); //damage dealt as a number
  var totalDamage = getTotalTeamDamage(match, teamId); //team's total damage
  var wards = getWardStats(pobj); //wards placed, wards killed, pinks placed
  var totalKills = getTotalKD(match, teamId, 'kills'); // team's kills
  if(totalKills == 0) { // just so we don't break
    totalKills = 1;
  }
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

/*
 * Get and set our promos status as well as LP
 * oldLP is the value before the most recent update, curLP is the current LP
 * previousPromos is the 'Yes'/'No' string from the sheet
 * leaguePromos is either the promo game results string or 'No'
 */
function getAndSetPromosLP(oldLP, curLP, previousPromos, leaguePromos, row) {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  // we're either not in promos or in promos with no games played
  if(leaguePromos == 'NNN' || leaguePromos == 'NNNNN' || leaguePromos == 'No') {
    if(leaguePromos == 'No' && sheet.getRange(row-1, getSheetTranslationIndex('Promos')).getValue() == 'Yes') {
      fixFinalPromoGame(row);
    }
    else {
      setCell('Promos', row, 'No');
    }
  }
  else { // we're in promos
    setCell('Promos', row, 'Yes');
  }
  
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

/*
 * Fix the final promo game if we detect it might not be tracked
 * Remember that Riot won't tell us we're in promos when we check the final game
 */
function fixFinalPromoGame(row) {
  // determine if we've played the right amount of promo games or not
  // we needed 2 wins or losses (3 if in division 1 promos)
  // if we haven't gotten enough, then correct the current game to be promos
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var division = sheet.getRange(row - 1, getSheetTranslationIndex('Promos')).getValue();
  var wins = 0;
  var losses = 0;
  var winsNeeded = (division === 'I' ? 3 : 2);
  var lossesNeeded = winsNeeded;
  var i = row - 1;
  while(sheet.getRange(i, getSheetTranslationIndex('Promos')).getValue() == 'Yes') {
    if(sheet.getRange(i, getSheetTranslationIndex('Result')).getValue() == 'Win') {
      wins++;
    }
    else {
      losses++;
    }
    i--;
  }
  if(wins == winsNeeded || losses == lossesNeeded) {
    setCell('Promos', row, 'No');
  }
  else { // we didn't have enough wins/losses to finish promos so this game must have been a promo game
    setCell('Promos', row, 'Yes');
  }
} 

/*
 * Fix any row that has some information wrong
 * Requires the user to specify the row to update
 */
function fixRow() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var row = getInfo('correct_row');
  if(!row) {
    return;
  }
  var matchId = sheet.getRange(row , getSheetTranslationIndex('Match Id')).getValue();
  if(matchId) {
    populate([matchId], row, true); // true prevents us from updating the league info
  }
  // this only happens if matchId is empty, and matchId gets filled in every row, guaranteed
  // so the only way this happens is if they supply an empty row
  else {
    Browser.msgBox("Error, row does not contain valid data to correct");
  }
}  

/*
 * Get the patch version as a string
 */
function getPatch(match) {
  // to remove the extra version info we don't need, we only want major.minor
  var patch = match['matchVersion'].split('.');
  return patch[0].concat('.').concat(patch[1]);
}

/*
 * Private function
 * Used to add new columns and populate data for existing entries
 */
function fixColumn() {
  var columns = ['Patch'];
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  for(var i = 520; i < getFirstEmptyRow(); i++) {
    var matchId = sheet.getRange(i , getSheetTranslationIndex('Match Id')).getValue();
    var match = getMatch(matchId);
    var patch = getPatch(match);
    setCell('Patch', i, patch);
  }
}

/*
 * Get the current patch based on our last match
 * This is used to assist in our filtering data by patch
 */
function getCurrentPatch() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  return sheet.getRange(getFirstEmptyRow()-1, getSheetTranslationIndex('Patch')).getValue();
}

function getResultPercentageEnemies() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var data = {};
  var lanes = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
  for(var i = 1; i < getFirstEmptyRow(); i++) {
    var result  = sheet.getRange(i, getSheetTranslationIndex('Result'));
    for(pos in lanes) {
      var champ = sheet.getRange(i, getSheetTranslationIndex('Their '.concat(lanes[pos])));
      if(!data[champ]) {
        data[champ] = {'Win':0, 'Loss': 0};
      }
      data[champ][result]++;
    }
  }
}      

/*
 * Calculate the KDA variance of all champions
 */
function kdaVariance() {
  var stats = {};
  var s = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = s.getSheetByName('Data');
  var roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
  var teams = ['My ', 'Their '];
  for(var i = 2; i < getFirstEmptyRow(); i++) {
    for(var j = 0; j < teams.length; j++) {
      for(var k = 0; k < roles.length; k++) {
        var champ = sheet.getRange(i, getSheetTranslationIndex(teams[j].concat(roles[k]))).getValue();
        var kda = sheet.getRange(i, getSheetTranslationIndex(teams[j].concat(roles[k]).concat(' KDA'))).getValue();
        if(stats[champ]) {
          stats[champ].push(kda);
        }
        else {
          stats[champ] = [kda];
        }
      }
    }
  }
  //have all the kdas in arrays in the json objects
  var data = []; // 2d array of [champion, variance]
  for(var key in stats) {
    data.push([key, variance(stats[key], average(stats[key]))]);
  }
  return data;
}

function average(numbers) {
  var total = 0;
  for(var i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total / numbers.length;
}

function variance(numbers, average) {
  var newNumbers = [];
  for(var i = 0; i < numbers.length; i++) {
    newNumbers.push(Math.pow((numbers[i] - average), 2));
  }
  return average(newNumbers);
}

/*
 * Checks if the response code has an error
 * Returns false if we got 200 OK, true if for some reason we failed
 * Returns "exit" if we should be terminating the program
 * Returns an integer that specifies the timeout period if we get 429
 * Displays alerts to help the user if we get a timeout code from Riot
 */
function checkStatusError(response) {
  var code = response.getResponseCode();
  if(code == 200) {
    return false;
  }
  // calling function will wait for the specified period OR a default of 10s
  // if the error persists and keeps retrying, the script will timeout after 5 minutes by Google's enforced limit on scripts
  else if(code == 429) { 
    if(response.getAllHeaders()['Retry-After']) {
      return response.getAllHeaders()['Retry-After'];
    }
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
