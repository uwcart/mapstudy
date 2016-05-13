<?PHP

ini_set('display_errors', 1); 
require('../config/param.php');

$post_data = file_get_contents("php://input");
$post_data = json_decode($post_data, TRUE);

// echo var_dump($post_data);

//insert data into database if used
if (isset($dbtype, $dbhost, $dbport, $dbname, $dbuser, $dbpassword)){
	if ($dbtype == 'pgsql'){
		//test db credentials
		try {
			$dbh = new PDO("pgsql:host=$dbhost port=$dbport dbname=$dbname", $dbuser, $dbpassword);
			$dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		} catch (PDOException $e) {
			echo 'Error: ' . $e->getMessage();
		}

		function makeParticipantTable($dbh, $pid){
			//create participant data table if it doesn't exist
			$sql = "CREATE TABLE IF NOT EXISTS p".$pid."_interactions (timestp text primary key, interaction text, page integer, set integer);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function makeBigTable($dbh, $tname, $cols){
			$cols = implode(' integer, ', $cols);
			//create data table if it doesn't exist
			$sql = "CREATE TABLE IF NOT EXISTS $tname (pid integer primary key, $cols integer, int_string text);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function updateInteraction($dbh, $tn, $pid, $icol, $icount, $intstring){
			$sql = "UPDATE $tn SET ($icol, int_string) = (:icount, :intstring) WHERE pid = :pid;";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->bindParam(':pid', $pid);
				$stmt->bindParam(':icount', $icount);
				$stmt->bindParam(':intstring', $intstring);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function addBigTableData($dbh, $tn, $pid, $interaction){
			//add row for participant if needed
			$sql = "INSERT INTO $tn (pid) SELECT :pid WHERE NOT EXISTS ".
				"(SELECT pid FROM $tn WHERE pid = :pid);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->bindParam(':pid', $pid);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}

			//get existing interaction data for participant
			$sql = "SELECT * FROM $tn WHERE pid = :pid";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->bindParam(':pid', $pid);
				$stmt->execute();
				//get current interaction count and string
				$row = $stmt -> fetch();
				foreach($row as $c => $val){
					if ($c === $interaction){
						// echo 'col: '.$c.', interaction: '.$interaction.', value: '.$val.';; ';
						$icol = $interaction;
						if (is_null($val)){
							$icount = 1;
						} else {
							$icount = $val+1;
						}
					} elseif ($c === 'int_string') {
						if (is_null($val)){
							$intstring = $interaction;
						} else {
							$intstring = $val.', '.$interaction;
						}
					}
				}
				updateInteraction($dbh, $tn, $pid, $icol, $icount, $intstring);
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function makeTables($dbh, $data){
			//make participant table
			$pid = $data["pid"];
			makeParticipantTable($dbh, $pid);
			//make page tables and fill columns for master table
			$pages = $data["pages"];
			$cols = array();
			foreach($pages as $p => $page){
				$pageCols = array();
				if (isset($page["interactions"])){
					$interactions = $page["interactions"];
					foreach($interactions as $interaction => $junk){
						$pageCols[] = $interaction;
						if (!in_array($interaction, $cols)){
							$cols[] = $interaction;
						}
					}
				}
				if (!empty($pageCols)){
					makeBigTable($dbh, 'interactions_page_'.(string)($p+1), $pageCols);
				}
			}
			//make master table
			if (!empty($cols)){
				makeBigTable($dbh, 'interactions_master', $cols);
			}
		}

		function updateTables($dbh, $data){
			$pid = $data["pid"];
			$interaction = $data["interaction"];
			$tmsp = $data["tmsp"];
			$page = $data["page"];
			$set = $data["set"];

			//insert data into master interactions table
			addBigTableData($dbh, 'interactions_master', $pid, $interaction);
			//insert data into page table
			addBigTableData($dbh, 'interactions_page_'.$page, $pid, $interaction);

			//insert data into participant interactions table
			$sql = "INSERT INTO p".$pid."_interactions (timestp, interaction, page, set) VALUES (:timestp, :interaction, :page, :set);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->bindParam(':timestp', $tmsp);
				$stmt->bindParam(':interaction', $interaction);
				$stmt->bindParam(':page', $page);
				$stmt->bindParam(':set', $set);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		if (isset($post_data["pages"])){
			makeTables($dbh, $post_data);
		} else {
			updateTables($dbh, $post_data);
		}
	}
}

//e-mail data if e-mail is set up
if (isset($smtphost, $smtpport, $euser, $epass, $toaddr, $subject, $message)){
	//variables of great social and political import
	$pid = $post_data["pid"];
	//check for directory and create if not exists
	if (!file_exists("../participants")){
		mkdir("../participants", 0777, true);
	}
	//check for file and create with column headers if not exists
	$filepath = "../participants/p".$pid."_interactions.csv";
	if (!file_exists($filepath)){
		$cols = "timestp, interaction, page, set\n";
		$file = fopen($filepath, "w") or die("Can't open file!");
		fwrite($file, $cols);
		fclose($file);
	}
	if (!empty($post_data["interaction"])){
		//add row
		$row = $post_data["tmsp"] . ", " .
			$post_data["interaction"] . ", " .
			$post_data["page"] . ", " .
			$post_data["set"] . "\n";
		//write row to file
		$file = fopen($filepath, "a") or die("Can't open file!");
		fwrite($file, $row);
		fclose($file);
	}
}

?>