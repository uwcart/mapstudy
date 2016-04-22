<?PHP

ini_set('display_errors', 1); 
require('../config/param.php');

$post_data = file_get_contents("php://input");
$post_data = json_decode($post_data, TRUE);
$pid = $post_data["pid"]["value"];

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
			$sql = "CREATE TABLE IF NOT EXISTS p".$pid."_data (label text primary key, question text, answer text);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function makeBigTable($dbh, $tname){
			//create data table if it doesn't exist
			$sql = "CREATE TABLE IF NOT EXISTS $tname (pid integer primary key);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function addBigTableData($dbh, $pid, $tn, $cs, $ps, $vs){
			//add columns if needed
			foreach($cs as $key => $col){
				$sql = "DO $$ BEGIN IF NOT EXISTS (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='$tn' AND column_name='$col') THEN ALTER TABLE $tn ADD COLUMN $col text; END IF; END $$";
				try {
					$stmt = $dbh->prepare($sql);
					$stmt->execute();
				} catch (PDOException $e) {
					echo 'SQL Query: ', $sql;
					echo 'Error: ' . $e->getMessage();
				}
			}
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
			//turn arrays into strings
			$cs = implode(", ", $cs);
			$ps = implode(", ", $ps);
			$vs["pid"] = $pid;
			//add data to data table
			$sql = "UPDATE $tn SET ($cs) = ($ps) WHERE pid = :pid;";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute($vs);
				echo "success!";
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}
		
		makeParticipantTable($dbh, $pid);
		makeBigTable($dbh, 'data_master');

		//set arrays for big table columns and values
		$columns = array();
		$placeholders = array();
		$values = array();
		$asks = array();
		$page = -1;
		$pages = array();
		$pageArray = array();
		foreach($post_data as $key => $block){
			if ($block["name"] != 'pid' && $block["name"] != 'updatetime'){
				//set page
				if ($block["page"] > $page){
					$page = $block["page"];
					$pageArray = array();
					$pageArray["columns"] = array();
					$pageArray["placeholders"] = array();
					$pageArray["values"] = array();
				}
				//set array values
				$column = $block["name"];
				$text = $block["ask"];
				$value = $block["value"];
				$columns[] = $column;
				$pageArray["columns"][] = $column;
				$placeholders[] = ":".$column;
				$pageArray["placeholders"][] = ":".$column;
				$values[$column] = $value;
				$pageArray["values"][$column] = $value;
				$pages[$page] = $pageArray;

				//add row for question if needed
				$sql = "INSERT INTO p".$pid."_data SELECT :label WHERE NOT EXISTS ".
					"(SELECT label FROM p".$pid."_data WHERE label = :label);";
				try {
					$stmt = $dbh->prepare($sql);
					$stmt->bindParam(':label', $column);
					$stmt->execute();
				} catch (PDOException $e) {
					echo 'SQL Query: ', $sql;
					echo 'Error: ' . $e->getMessage();
				}

				//insert data into participant data table
				$sql = "UPDATE p".$pid."_data SET (question, answer) = (:question, :answer) WHERE label = :label;";
				try {
					$stmt = $dbh->prepare($sql);
					$stmt->bindParam(':label', $column);
					$stmt->bindParam(':question', $text);
					$stmt->bindParam(':answer', $value);
					$stmt->execute();
				} catch (PDOException $e) {
					echo 'SQL Query: ', $sql;
					echo 'Error: ' . $e->getMessage();
				}
			}
		}

		//insert data into master data table
		addBigTableData($dbh, $pid, 'data_master', $columns, $placeholders, $values);

		//insert data into page tables
		foreach($pages as $p => $pArr){
			echo var_dump($pArr);
			makeBigTable($dbh, 'data_page_'.$p);
			addBigTableData($dbh, $pid, 'data_page_'.$p, $pArr["columns"], $pArr["placeholders"], $pArr["values"]);
		}
	}
}

//e-mail data if e-mail is set up
if (isset($email, $from, $subject, $message)){


}

?>