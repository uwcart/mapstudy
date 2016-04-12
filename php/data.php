<?PHP

ini_set('display_errors', 1); 
require('../config/param.php');

$post_data = file_get_contents("php://input");
$post_data = json_decode($post_data, TRUE);

//insert data into database if used
if (isset($dbtype, $dbhost, $dbport, $dbname, $dbuser, $dbpassword, $dbtable)){
	if ($dbtype == 'pgsql'){
		$userId = $post_data["userId"];
		$columns = array();
		$placeholders = array();
		$values = array();
		foreach($post_data as $column => $value){
			$columns[] = $column;
			$placeholders[] = ":".$column;
			$values[$column] = $value;
		}
		$columns = implode(", ", $columns);
		$placeholders = implode(", ", $placeholders);
		$sql = "INSERT INTO $dbtable (userid) SELECT :userId WHERE NOT EXISTS ".
			"(SELECT userid FROM $dbtable WHERE userid = :userId);";
		try {
			$dbh = new PDO("pgsql:host=$dbhost port=$dbport dbname=$dbname", $dbuser, $dbpassword);
			$dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			$stmt = $dbh->prepare($sql);
			$stmt->bindParam(':userId', $userId);
			$stmt->execute();
		} catch (PDOException $e) {
			echo 'SQL Query: ', $sql;
			echo 'Error: ' . $e->getMessage();
		}
		$sql = "UPDATE $dbtable SET ($columns) = ($placeholders) WHERE userid = :userId;";
		try {
			$stmt = $dbh->prepare($sql);
			$stmt->execute($values);
			echo "success!";
		} catch (PDOException $e) {
			echo 'SQL Query: ', $sql;
			echo 'Error: ' . $e->getMessage();
		}
	}
}

echo var_dump($post_data);

//e-mail data if e-mail is set up
if (isset($email, $from, $subject, $message)){


}

?>